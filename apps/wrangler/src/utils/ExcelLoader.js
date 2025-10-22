// ExcelLoader - Handles Excel file loading and parsing

import * as XLSX from 'xlsx';

class ExcelLoader {
    constructor() {
        // This class is stateless and operates on provided data
    }

    async getExcelSheetNames(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });
                    resolve(workbook.SheetNames);
                } catch (error) {
                    reject(new Error(`Failed to read Excel file: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read Excel file'));
            };

            reader.readAsBinaryString(file);
        });
    }

    async loadExcelData(file, sheetName = null, dataStoreInstance) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'binary' });

                    // Use provided sheet name or first sheet
                    const targetSheetName = sheetName || workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[targetSheetName];

                    if (!worksheet) {
                        throw new Error(`Sheet "${targetSheetName}" not found`);
                    }

                    // Convert to JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    dataStoreInstance.processedData = dataStoreInstance.initializeBdsaStructure(jsonData);
                    dataStoreInstance.dataSource = 'excel';
                    dataStoreInstance.dataSourceInfo = {
                        fileName: file.name,
                        fileSize: file.size,
                        lastModified: file.lastModified,
                        sheetName: targetSheetName
                    };
                    dataStoreInstance.dataLoadTimestamp = new Date().toISOString();
                    console.log(`🧹 Clearing modifiedItems (${dataStoreInstance.modifiedItems.size} items) from:`, new Error().stack);
                    dataStoreInstance.modifiedItems.clear();

                    // Clear case ID mappings when loading new data (they're specific to the previous dataset)
                    dataStoreInstance.caseIdMappings.clear();
                    dataStoreInstance.caseIdConflicts.clear();
                    dataStoreInstance.bdsaCaseIdConflicts.clear();

                    // Skip saveToStorage() for large datasets to avoid quota errors
                    // dataStoreInstance.saveToStorage();
                    dataStoreInstance.notify();

                    resolve({
                        success: true,
                        itemCount: jsonData.length,
                        message: `Successfully loaded ${jsonData.length} items from Excel sheet "${targetSheetName}"`
                    });
                } catch (error) {
                    reject(new Error(`Failed to parse Excel file: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read Excel file'));
            };

            reader.readAsBinaryString(file);
        });
    }
}

const excelLoader = new ExcelLoader();
export default excelLoader;
