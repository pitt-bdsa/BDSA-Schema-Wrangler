/**
 * DSA Batch Processor
 * Handles batch processing of multiple items with progress tracking, retries, and rate limiting
 */

/**
 * Batch processor for syncing multiple items with progress tracking
 */
export class DsaBatchProcessor {
    constructor(baseUrl, girderToken, options = {}) {
        this.baseUrl = baseUrl;
        this.girderToken = girderToken;
        this.options = {
            batchSize: 5, // Process 5 items concurrently
            delayBetweenBatches: 1000, // 1 second delay between batches
            retryAttempts: 3,
            retryDelay: 2000,
            ...options
        };
        this.cancelled = false;
        this.progressCallback = null;
        this.results = [];
    }

    /**
     * Sets progress callback function
     * @param {Function} callback - Progress callback (current, total, results)
     */
    onProgress(callback) {
        this.progressCallback = callback;
        return this;
    }

    /**
     * Cancels the batch processing
     */
    cancel() {
        this.cancelled = true;
        console.log('🚫 Batch processing cancelled - stopping all future batches');
        // Force immediate cancellation by throwing an error to break out of any ongoing operations
        this.cancelError = new Error('Batch processing cancelled by user');
    }

    /**
     * Processes items in batches with rate limiting
     * @param {Array} items - Items to process
     * @param {Object} columnMapping - Column mapping configuration
     * @param {Function} processor - Processing function for each item
     * @returns {Promise<Object>} Batch processing results
     */
    async processBatch(items, columnMapping, processor) {
        this.results = [];
        this.cancelled = false;

        const totalItems = items.length;
        let processedCount = 0;
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        console.log(`Starting batch processing of ${totalItems} items...`);

        // Early exit if no items to process
        if (totalItems === 0) {
            console.log('No items to process - batch complete');
            return {
                completed: true,
                totalItems: 0,
                processed: 0,
                success: 0,
                errors: 0,
                skipped: 0,
                results: []
            };
        }

        try {
            // Process items in batches
            for (let i = 0; i < items.length; i += this.options.batchSize) {
                if (this.cancelled) {
                    console.log('🚫 Batch processing cancelled by user - breaking main loop');
                    throw this.cancelError;
                }

                const batch = items.slice(i, i + this.options.batchSize);
                console.log(`Processing batch ${Math.floor(i / this.options.batchSize) + 1}, items ${i + 1}-${Math.min(i + this.options.batchSize, totalItems)}`);

                // Check for cancellation before starting batch
                if (this.cancelled) {
                    console.log('🚫 Batch processing cancelled before starting batch');
                    throw this.cancelError;
                }

                // Process batch items concurrently with cancellation support
                const batchPromises = batch.map(async (item) => {
                    if (this.cancelled) {
                        console.log(`🚫 Skipping item ${item._id || item.dsa_id} due to cancellation`);
                        throw this.cancelError;
                    }

                    let attempts = 0;
                    while (attempts < this.options.retryAttempts && !this.cancelled) {
                        if (this.cancelled) {
                            console.log(`🚫 Cancelled during retry loop for item ${item._id || item.dsa_id}`);
                            throw this.cancelError;
                        }

                        try {
                            // Pass cancellation check function to the processor
                            const result = await processor(this.baseUrl, item, this.girderToken, columnMapping, () => this.cancelled);
                            return result;
                        } catch (error) {
                            if (this.cancelled) {
                                console.log(`🚫 Cancelled during error handling for item ${item._id || item.dsa_id}`);
                                throw this.cancelError;
                            }

                            attempts++;
                            if (attempts < this.options.retryAttempts && !this.cancelled) {
                                console.log(`Retry attempt ${attempts} for item ${item._id || item.dsa_id}`);
                                await this.delay(this.options.retryDelay);
                            } else {
                                console.error(`Failed after ${this.options.retryAttempts} attempts:`, error);
                                return {
                                    success: false,
                                    itemId: item._id || item.dsa_id || 'unknown',
                                    error: error.message
                                };
                            }
                        }
                    }

                    if (this.cancelled) {
                        console.log(`🚫 Cancelled processing item ${item._id || item.dsa_id}`);
                        throw this.cancelError;
                    }
                });

                // Wait for batch to complete, but check for cancellation during processing
                // Use a more aggressive cancellation approach
                const batchResults = [];
                for (const promise of batchPromises) {
                    if (this.cancelled) {
                        console.log('Batch processing cancelled during promise execution');
                        break;
                    }
                    try {
                        const result = await promise;
                        if (result) {
                            batchResults.push({ status: 'fulfilled', value: result });
                        }
                    } catch (error) {
                        batchResults.push({ status: 'rejected', reason: error });
                    }
                }

                // Check for cancellation immediately after batch completion
                if (this.cancelled) {
                    console.log('Batch processing cancelled after batch completion');
                    break;
                }

                // Process results and track batch activity
                let batchHadUpdates = false;
                batchResults.forEach(promiseResult => {
                    // Handle Promise.allSettled format
                    const result = promiseResult.status === 'fulfilled' ? promiseResult.value : null;

                    if (result) {
                        this.results.push(result);
                        processedCount++;

                        if (result.success) {
                            successCount++;
                            batchHadUpdates = true; // Track that we had actual updates
                        } else if (result.skipped) {
                            skippedCount++;
                            // Skipped items don't count as updates
                        } else {
                            errorCount++;
                            batchHadUpdates = true; // Errors still count as server activity
                        }
                    } else if (promiseResult.status === 'rejected') {
                        console.error('Promise rejected during batch processing:', promiseResult.reason);
                        errorCount++;
                        batchHadUpdates = true;
                    }
                });

                // Update progress
                if (this.progressCallback) {
                    this.progressCallback({
                        processed: processedCount,
                        total: totalItems,
                        success: successCount,
                        errors: errorCount,
                        skipped: skippedCount,
                        percentage: Math.round((processedCount / totalItems) * 100)
                    });
                }

                // Check for cancellation before applying delay
                if (this.cancelled) {
                    console.log('Batch processing cancelled before delay');
                    break;
                }

                // Only delay between batches if we had actual updates (not just skips)
                if (i + this.options.batchSize < items.length && !this.cancelled && batchHadUpdates) {
                    console.log(`Batch had ${successCount + errorCount} updates, applying ${this.options.delayBetweenBatches}ms delay...`);
                    await this.delay(this.options.delayBetweenBatches);
                } else if (i + this.options.batchSize < items.length && !this.cancelled) {
                    console.log('Batch had only skips, no delay needed - continuing immediately');
                }
            }
        } catch (error) {
            if (error === this.cancelError) {
                console.log('🚫 Batch processing cancelled by user');
            } else {
                console.error('🚫 Batch processing error:', error);
            }
        }

        const summary = {
            completed: !this.cancelled,
            totalItems,
            processed: processedCount,
            success: successCount,
            errors: errorCount,
            skipped: skippedCount,
            results: this.results
        };

        console.log('Batch processing complete:', summary);
        return summary;
    }

    /**
     * Utility function for delays
     * @param {number} ms - Milliseconds to delay
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
