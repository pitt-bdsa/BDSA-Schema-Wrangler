// CsvLoader - Handles CSV file loading and parsing

class CsvLoader {
    constructor() {
        // This class is stateless and operates on provided data
    }

    async loadCsvData(file, dataStoreInstance) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const csvText = e.target.result;
                    const data = this.parseCsv(csvText, file.name);

                    dataStoreInstance.processedData = dataStoreInstance.initializeBdsaStructure(data);
                    dataStoreInstance.dataSource = 'csv';
                    dataStoreInstance.dataSourceInfo = {
                        fileName: file.name,
                        fileSize: file.size,
                        lastModified: file.lastModified
                    };
                    dataStoreInstance.dataLoadTimestamp = new Date().toISOString();
                    console.log(`🧹 Clearing modifiedItems (${dataStoreInstance.modifiedItems.size} items) from:`, new Error().stack);
                    dataStoreInstance.modifiedItems.clear();

                    // Enable BDSA tracking for the loaded data
                    dataStoreInstance.enableBdsaTracking();

                    // Clear case ID mappings when loading new data (they're specific to the previous dataset)
                    dataStoreInstance.caseIdMappings.clear();
                    dataStoreInstance.caseIdConflicts.clear();
                    dataStoreInstance.bdsaCaseIdConflicts.clear();

                    // Skip saveToStorage() for large datasets to avoid quota errors
                    // dataStoreInstance.saveToStorage();
                    dataStoreInstance.notify();

                    resolve({
                        success: true,
                        itemCount: data.length,
                        message: `Successfully loaded ${data.length} items from CSV`
                    });
                } catch (error) {
                    reject(new Error(`Failed to parse CSV: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read CSV file'));
            };

            reader.readAsText(file);
        });
    }

    parseCsv(csvText, fileName = 'unknown') {
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            throw new Error('CSV file must have at least a header and one data row');
        }

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const data = [];

        // Create a unique prefix based on filename and timestamp
        const filePrefix = fileName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const timestamp = Date.now();

        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCsvLine(lines[i]);
            if (values.length !== headers.length) {
                console.warn(`Row ${i + 1} has ${values.length} values but expected ${headers.length}`);
                continue;
            }

            const item = {};
            headers.forEach((header, index) => {
                item[header] = values[index];
            });

            // Add consistent row identifier and BDSA structure
            item.id = `csv_${filePrefix}_${timestamp}_row_${i}`;
            item.BDSA = {
                bdsaLocal: {
                    localCaseId: null,
                    localStainID: null,
                    localRegionId: null
                },
                _dataSource: {},
                _lastModified: new Date().toISOString()
            };

            data.push(item);
        }

        return data;
    }

    parseCsvLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim().replace(/"/g, ''));
                current = '';
            } else {
                current += char;
            }
        }

        values.push(current.trim().replace(/"/g, ''));
        return values;
    }
}

const csvLoader = new CsvLoader();
export default csvLoader;
