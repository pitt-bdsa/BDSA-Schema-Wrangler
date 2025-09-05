import React, { useState, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import 'ag-grid-community/styles/ag-theme-balham.css';
import 'ag-grid-community/styles/ag-theme-material.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';
import Papa from 'papaparse';
import ColumnControl from './ColumnControl';
import RegexRulesModal from './RegexRulesModal';
import { applyRegexRules, getDefaultRegexRules } from '../utils/regexExtractor';
import {
    DATA_SOURCE_TYPES,
    loadColumnWidths,
    saveColumnWidths,
    loadCaseIdMappings,
    saveCaseIdMappings,
    loadCaseProtocolMappings,
    saveCaseProtocolMappings,
    loadDsaConfig,
    saveDsaConfig,
    loadRegexRules,
    saveRegexRules,
    loadGridTheme,
    saveGridTheme,
    migrateOldSettings
} from '../utils/dataSourceManager';
import './InputDataTab.css';

ModuleRegistry.registerModules([AllCommunityModule]);

const InputDataTab = () => {
    const [rowData, setRowData] = useState([]);
    const [columnDefs, setColumnDefs] = useState([]);
    const [hiddenColumns, setHiddenColumns] = useState([]);
    const [columnMapping, setColumnMapping] = useState({
        localStainID: '',
        localCaseId: '',
        localRegionId: ''
    });
    const [loading, setLoading] = useState(true);
    const [gridTheme, setGridTheme] = useState('alpine');
    const [bdsaInstitutionId, setBdsaInstitutionId] = useState('001');
    const [showBdsaSettings, setShowBdsaSettings] = useState(false);
    const [caseIdMappings, setCaseIdMappings] = useState({});
    const [caseProtocolMappings, setCaseProtocolMappings] = useState({});
    const [stainProtocols, setStainProtocols] = useState([]);
    const [regionProtocols, setRegionProtocols] = useState([]);

    const [columnWidths, setColumnWidths] = useState({});
    const [columnOrder, setColumnOrder] = useState([]);

    // Data source selection state
    const [dataSource, setDataSource] = useState('csv'); // 'csv' or 'dsa'
    const [dsaConfig, setDsaConfig] = useState({
        baseUrl: 'http://multiplex.pathology.emory.edu:8080',
        resourceId: '68bb20d0188a3d83b0a175da', // Your specific folder ID
        resourceType: 'folder', // 'collection' or 'folder'
        apiKey: ''
    });
    const [girderToken, setGirderToken] = useState('');
    const [showDsaConfig, setShowDsaConfig] = useState(false);
    const [showRegexRules, setShowRegexRules] = useState(false);
    const [regexRules, setRegexRules] = useState(getDefaultRegexRules());
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        const initializeApp = async () => {
            // Migrate old settings first
            migrateOldSettings();

            // Load initial settings
            setGridTheme(loadGridTheme());
            loadStainProtocols();
            loadRegionProtocols();
            loadSettingsForDataSource(dataSource);

            // Small delay to ensure smooth loading
            await new Promise(resolve => setTimeout(resolve, 100));

            // Mark as initialized to prevent flash
            setIsInitialized(true);
        };

        initializeApp();
    }, []);

    // Handle data source changes
    useEffect(() => {
        if (dataSource) {
            loadSettingsForDataSource(dataSource);
            // Ensure loading state is cleared when switching data sources
            setLoading(false);
        }
    }, [dataSource]);

    const handleDataSourceChange = (newDataSource) => {
        // Save current settings before switching
        saveSettingsForDataSource(dataSource);

        // Clear current data and loading state
        setRowData([]);
        setColumnDefs([]);
        setLoading(false);

        // Switch data source
        setDataSource(newDataSource);
    };

    // Load data when mappings are available or when data source changes
    useEffect(() => {
        if (dataSource === 'csv') {
            // Always load CSV data when CSV is selected
            loadCSVData();
        }
        // Note: DSA data loading is now handled manually via the "Load DSA Data" button
        // No automatic loading for DSA to prevent conflicts
    }, [dataSource]);

    // Also load CSV data when mappings change (for updates)
    useEffect(() => {
        if (dataSource === 'csv' &&
            ((caseIdMappings && Object.keys(caseIdMappings).length > 0) ||
                (caseProtocolMappings && Object.keys(caseProtocolMappings).length > 0))) {
            loadCSVData();
        }
    }, [caseIdMappings, caseProtocolMappings, columnMapping]);

    // Refresh protocols when they change
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'bdsa_stain_protocols' || e.key === 'bdsa_region_protocols' || e.key === 'bdsa_case_mappings') {
                loadStainProtocols();
                loadRegionProtocols();
                loadCaseProtocolMappings();
            }
        };

        const handleCustomProtocolChange = () => {
            console.log('Protocol mappings changed event received');
            loadStainProtocols();
            loadRegionProtocols();
            loadCaseProtocolMappings();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('protocolMappingsChanged', handleCustomProtocolChange);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('protocolMappingsChanged', handleCustomProtocolChange);
        };
    }, []);

    const exportEnrichedData = () => {
        if (rowData.length === 0) return;

        // Create enriched data with current mappings
        const enrichedData = rowData.map(row => {
            const localCaseId = row[columnMapping.localCaseId];
            const filename = row['name'];

            if (localCaseId && filename) {
                const bdsaCaseId = caseIdMappings[localCaseId];
                if (bdsaCaseId) {
                    const slideId = `${bdsaCaseId}_${filename}`;
                    const protocols = (caseProtocolMappings || {})[bdsaCaseId]?.[slideId] || [];
                    return {
                        ...row,
                        bdsa_stain_protocols: Array.isArray(protocols) ? protocols.join(',') : ''
                    };
                }
            }

            return {
                ...row,
                bdsa_stain_protocols: ''
            };
        });

        // Convert to CSV
        const headers = Object.keys(enrichedData[0]);
        const csvContent = [
            headers.join(','),
            ...enrichedData.map(row =>
                headers.map(header => {
                    const value = row[header] || '';
                    // Escape commas and quotes in CSV
                    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                        return `"${value.replace(/"/g, '""')}"`;
                    }
                    return value;
                }).join(',')
            )
        ].join('\n');

        // Download the file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'enriched_metadata_with_stain_protocols.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    };

    const loadCSVData = async () => {
        try {
            const response = await fetch('/year_2020_dsametadata.csv');
            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const data = results.data;

                    const columns = Object.keys(data[0] || {}).map(key => ({
                        field: key,
                        headerName: key,
                        sortable: true,
                        filter: true,
                        resizable: true,
                        minWidth: 150
                    }));

                    setColumnDefs(columns);
                    setRowData(data);
                    setLoading(false);
                },
                error: (error) => {
                    console.error('Error parsing CSV:', error);
                    setLoading(false);
                }
            });
        } catch (error) {
            console.error('Error loading CSV:', error);
            setLoading(false);
        }
    };

    const loadDsaData = async () => {
        try {
            setLoading(true);

            if (!dsaConfig?.baseUrl || !dsaConfig?.resourceId) {
                console.error('DSA configuration incomplete');
                setLoading(false);
                return;
            }

            // Build the API endpoint URL - use the resource endpoint with type parameter
            const apiUrl = `${dsaConfig.baseUrl}/api/v1/resource/${dsaConfig.resourceId}/items?type=${dsaConfig.resourceType || 'folder'}`;

            // Prepare headers
            const headers = {
                'Content-Type': 'application/json'
            };

            // Use Girder token for authentication
            console.log('Authentication state:', {
                girderToken: girderToken ? `${girderToken.substring(0, 10)}...` : 'empty'
            });

            if (girderToken) {
                headers['Girder-Token'] = girderToken;
                console.log('Using girderToken for authentication');
            } else {
                console.error('No Girder token available! Please click "Get Girder Token" first.');
                alert('No Girder token available! Please click "Get Girder Token" first to authenticate.');
                setLoading(false);
                return;
            }

            console.log('Request headers:', { ...headers, 'Girder-Token': '[REDACTED]' });
            console.log('Request URL:', apiUrl);

            // Fetch data from DSA
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: headers
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('DSA API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    url: apiUrl,
                    headers: headers,
                    response: errorText
                });

                // Try to parse the error response as JSON
                try {
                    const errorJson = JSON.parse(errorText);
                    console.error('Parsed error response:', errorJson);

                    // Check if it's a permission issue
                    if (errorJson.type === 'access' && errorJson.message.includes('Read access denied')) {
                        console.error('PERMISSION ERROR: The authenticated user does not have read access to this resource.');
                        console.error('Resource ID:', dsaConfig.resourceId);
                        console.error('Resource Type:', dsaConfig.resourceType);
                        console.error('Token being used:', girderToken ? `${girderToken.substring(0, 20)}...` : 'None');
                    }
                } catch (parseError) {
                    console.error('Could not parse error response as JSON:', parseError);
                }

                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const dsaData = await response.json();

            // Transform and flatten DSA data to match expected format
            const transformedData = transformDsaData(dsaData);

            if (transformedData.length > 0) {
                const columns = Object.keys(transformedData[0] || {}).map(key => ({
                    field: key,
                    headerName: key,
                    sortable: true,
                    filter: true,
                    resizable: true,
                    minWidth: 150
                }));

                setColumnDefs(columns);
                setRowData(transformedData);
            } else {
                setColumnDefs([]);
                setRowData([]);
            }

            setLoading(false);
        } catch (error) {
            console.error('Error loading DSA data:', error);
            setLoading(false);
        }
    };

    const transformDsaData = (dsaData) => {
        // This function will transform DSA API response to match your expected data format
        // and flatten nested JSON dictionaries
        if (!dsaData || !Array.isArray(dsaData)) {
            return [];
        }

        const transformedData = dsaData.map(item => {
            // Flatten the entire item, including nested objects
            const flattenedItem = flattenObject(item);

            // Add some common field mappings for compatibility
            const transformedItem = {
                // Map common fields to expected names
                name: flattenedItem.name || flattenedItem._id || flattenedItem.id || '',
                localCaseId: flattenedItem['meta.caseId'] || flattenedItem['meta.localCaseId'] || flattenedItem.caseId || flattenedItem.localCaseId || '',
                localStainID: flattenedItem['meta.stainId'] || flattenedItem['meta.localStainID'] || flattenedItem.stainId || flattenedItem.localStainID || '',
                localRegionId: flattenedItem['meta.regionId'] || flattenedItem['meta.localRegionId'] || flattenedItem.regionId || flattenedItem.localRegionId || '',

                // Include all flattened fields
                ...flattenedItem,

                // Add original DSA fields for reference
                dsa_id: flattenedItem._id || flattenedItem.id || '',
                dsa_name: flattenedItem.name || ''
            };

            return transformedItem;
        });

        // Apply regex rules to extract missing values from filenames
        return applyRegexRules(transformedData, regexRules);
    };

    const flattenObject = (obj, prefix = '') => {
        // Recursively flatten nested objects
        const flattened = {};

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const newKey = prefix ? `${prefix}.${key}` : key;

                if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                    // Recursively flatten nested objects
                    Object.assign(flattened, flattenObject(obj[key], newKey));
                } else if (Array.isArray(obj[key])) {
                    // Handle arrays - convert to comma-separated string or keep as array
                    flattened[newKey] = obj[key].join(', ');
                } else {
                    // Handle primitive values
                    flattened[newKey] = obj[key];
                }
            }
        }

        return flattened;
    };

    const testDsaConnection = async () => {
        try {
            if (!dsaConfig.baseUrl || !dsaConfig.resourceId) {
                alert('Please fill in Base URL and Resource ID');
                return;
            }

            // Test the resource endpoint and items endpoint
            const resourceUrl = `${dsaConfig.baseUrl}/api/v1/resource/${dsaConfig.resourceId}`;
            const itemsUrl = `${dsaConfig.baseUrl}/api/v1/resource/${dsaConfig.resourceId}/items?type=${dsaConfig.resourceType}`;

            const headers = {
                'Content-Type': 'application/json'
            };

            // Use Girder token if available, otherwise try API key
            if (girderToken) {
                headers['Girder-Token'] = girderToken;
            } else if (dsaConfig.apiKey) {
                headers['Girder-Token'] = dsaConfig.apiKey;
            }

            // Test resource endpoint
            const resourceResponse = await fetch(resourceUrl, {
                method: 'GET',
                headers: headers
            });

            if (!resourceResponse.ok) {
                const errorText = await resourceResponse.text();
                console.error('Resource connection failed:', {
                    status: resourceResponse.status,
                    statusText: resourceResponse.statusText,
                    url: resourceUrl,
                    headers: headers,
                    response: errorText
                });
                alert(`Resource connection failed: ${resourceResponse.status} ${resourceResponse.statusText}\n\nURL: ${resourceUrl}\n\nThis might be an authentication issue. Please check your API key.`);
                return;
            }

            // Test items endpoint
            const itemsResponse = await fetch(itemsUrl, {
                method: 'GET',
                headers: headers
            });

            if (itemsResponse.ok) {
                const itemsData = await itemsResponse.json();
                const itemCount = Array.isArray(itemsData) ? itemsData.length : 0;
                alert(`Connection successful! ${dsaConfig.resourceType.charAt(0).toUpperCase() + dsaConfig.resourceType.slice(1)} ID: ${dsaConfig.resourceId}, Items found: ${itemCount}`);
            } else {
                alert(`Items endpoint failed: ${itemsResponse.status} ${itemsResponse.statusText}`);
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            alert(`Connection test failed: ${error.message}`);
        }
    };

    const testDsaConnectionNoAuth = async () => {
        try {
            if (!dsaConfig.baseUrl || !dsaConfig.resourceId) {
                alert('Please fill in Base URL and Resource ID');
                return;
            }

            // Test the resource endpoint without authentication
            const resourceUrl = `${dsaConfig.baseUrl}/api/v1/resource/${dsaConfig.resourceId}`;
            const itemsUrl = `${dsaConfig.baseUrl}/api/v1/resource/${dsaConfig.resourceId}/items?type=${dsaConfig.resourceType}`;

            const headers = {
                'Content-Type': 'application/json'
            };

            console.log('Testing without authentication:', { resourceUrl, itemsUrl });

            // Test resource endpoint
            const resourceResponse = await fetch(resourceUrl, {
                method: 'GET',
                headers: headers
            });

            console.log('Resource response:', {
                status: resourceResponse.status,
                statusText: resourceResponse.statusText,
                ok: resourceResponse.ok
            });

            if (!resourceResponse.ok) {
                const errorText = await resourceResponse.text();
                console.error('Resource connection failed (no auth):', {
                    status: resourceResponse.status,
                    statusText: resourceResponse.statusText,
                    url: resourceUrl,
                    response: errorText
                });
                alert(`Resource connection failed (no auth): ${resourceResponse.status} ${resourceResponse.statusText}\n\nURL: ${resourceUrl}\n\nResponse: ${errorText.substring(0, 200)}...`);
                return;
            }

            // Test items endpoint
            const itemsResponse = await fetch(itemsUrl, {
                method: 'GET',
                headers: headers
            });

            console.log('Items response:', {
                status: itemsResponse.status,
                statusText: itemsResponse.statusText,
                ok: itemsResponse.ok
            });

            if (itemsResponse.ok) {
                const itemsData = await itemsResponse.json();
                const itemCount = Array.isArray(itemsData) ? itemsData.length : 0;
                alert(`Connection successful (no auth)! ${dsaConfig.resourceType.charAt(0).toUpperCase() + dsaConfig.resourceType.slice(1)} ID: ${dsaConfig.resourceId}, Items found: ${itemCount}\n\nThis suggests authentication is required for your DSA instance.`);
            } else {
                const errorText = await itemsResponse.text();
                alert(`Items endpoint failed (no auth): ${itemsResponse.status} ${itemsResponse.statusText}\n\nURL: ${itemsUrl}\n\nResponse: ${errorText.substring(0, 200)}...`);
            }
        } catch (error) {
            console.error('Connection test failed (no auth):', error);
            alert(`Connection test failed (no auth): ${error.message}`);
        }
    };

    const exchangeApiKeyForToken = async () => {
        try {
            if (!dsaConfig.baseUrl || !dsaConfig.apiKey) {
                alert('Please fill in Base URL and API Key');
                return null;
            }

            // According to Girder docs, we need to use HTTP Basic Auth
            // The API key might be used as username with empty password, or as both username and password
            const tokenUrl = `${dsaConfig.baseUrl}/api/v1/user/authentication`;

            // Try different approaches for API key authentication
            const authAttempts = [
                // Approach 1: API key as username, empty password
                {
                    username: dsaConfig.apiKey,
                    password: '',
                    description: 'API key as username, empty password'
                },
                // Approach 2: API key as both username and password
                {
                    username: dsaConfig.apiKey,
                    password: dsaConfig.apiKey,
                    description: 'API key as both username and password'
                },
                // Approach 3: Try with ?apiKey= query parameter
                {
                    username: '',
                    password: '',
                    description: 'API key as query parameter',
                    useQueryParam: true
                }
            ];

            for (const attempt of authAttempts) {
                try {
                    console.log(`Attempting authentication: ${attempt.description}`);

                    let url = tokenUrl;
                    let headers = {};

                    if (attempt.useQueryParam) {
                        // Try with query parameter
                        url = `${tokenUrl}?apiKey=${encodeURIComponent(dsaConfig.apiKey)}`;
                        headers = {
                            'Content-Type': 'application/json'
                        };
                    } else if (attempt.username) {
                        // Use HTTP Basic Auth
                        const credentials = btoa(`${attempt.username}:${attempt.password}`);
                        headers = {
                            'Authorization': `Basic ${credentials}`,
                            'Content-Type': 'application/json'
                        };
                    }

                    console.log('Auth attempt:', { url, headers: { ...headers, Authorization: headers.Authorization ? '[REDACTED]' : undefined } });

                    const response = await fetch(url, {
                        method: 'GET',
                        headers: headers
                    });

                    console.log('Auth response:', {
                        status: response.status,
                        statusText: response.statusText,
                        ok: response.ok,
                        description: attempt.description
                    });

                    if (response.ok) {
                        const responseData = await response.json();
                        console.log('Authentication successful:', responseData);

                        // Extract token from authToken.token field as per Girder docs
                        const token = responseData.authToken?.token;

                        if (token) {
                            setGirderToken(token);
                            console.log('Girder token obtained:', token);
                            alert(`Authentication successful using: ${attempt.description}\n\nToken obtained: ${token.substring(0, 20)}...`);
                            return token;
                        } else {
                            console.error('No authToken.token found in response:', responseData);
                            alert(`Authentication successful but no token found in response.\n\nMethod: ${attempt.description}\n\nCheck console for full response.`);
                        }
                    } else {
                        const errorText = await response.text();
                        console.log(`Auth failed with ${attempt.description}:`, {
                            status: response.status,
                            statusText: response.statusText,
                            response: errorText
                        });
                    }
                } catch (error) {
                    console.error(`Auth attempt failed (${attempt.description}):`, error);
                }
            }

            alert('All authentication attempts failed. Please check your API key and try again.\n\nCheck browser console for detailed error information.');
            return null;

        } catch (error) {
            console.error('Token exchange error:', error);
            alert(`Token exchange error: ${error.message}`);
            return null;
        }
    };

    // Test if the user has access to the specific resource
    const testResourceAccess = async () => {
        try {
            if (!dsaConfig.baseUrl || !dsaConfig.resourceId) {
                alert('Please fill in Base URL and Resource ID first.');
                return;
            }

            if (!girderToken) {
                alert('No Girder token available! Please click "Get Girder Token" first to authenticate.');
                return;
            }

            const testUrl = `${dsaConfig.baseUrl}/api/v1/resource/${dsaConfig.resourceId}`;
            const headers = {
                'Content-Type': 'application/json',
                'Girder-Token': girderToken
            };

            console.log('Testing resource access:', { testUrl, headers: { ...headers, 'Girder-Token': '[REDACTED]' } });

            const response = await fetch(testUrl, {
                method: 'GET',
                headers: headers
            });

            console.log('Resource access test response:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (response.ok) {
                const resourceData = await response.json();
                console.log('Resource access test successful:', resourceData);
                alert(`SUCCESS! You have access to this resource.\n\nResource Name: ${resourceData.name || 'Unknown'}\nResource Type: ${resourceData._modelType || 'Unknown'}\nResource ID: ${resourceData._id || 'Unknown'}`);
            } else {
                const errorText = await response.text();
                console.log('Resource access test failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    response: errorText
                });

                // Try to parse the error to provide better feedback
                try {
                    const errorJson = JSON.parse(errorText);
                    if (errorJson.message && errorJson.message.includes('Read access denied')) {
                        alert(`FAILED! You do not have read access to this resource.\n\nThis could mean:\n1. The resource ID is incorrect\n2. The resource is private and requires specific permissions\n3. The resource type (collection/folder) is wrong\n\nError: ${errorText}\n\nTry using a public collection or check with the DSA administrator.`);
                    } else {
                        alert(`FAILED! You do not have access to this resource.\n\nError: ${errorText}`);
                    }
                } catch (parseError) {
                    alert(`FAILED! You do not have access to this resource.\n\nError: ${errorText}`);
                }
            }
        } catch (error) {
            console.error('Error testing resource access:', error);
            alert(`Error testing resource access: ${error.message}`);
        }
    };

    const testDirectToken = async () => {
        try {
            if (!dsaConfig.baseUrl) {
                alert('Please fill in Base URL first.');
                return;
            }

            // Use HTTP Basic Auth with admin:password to get a proper Girder token
            const authUrl = `${dsaConfig.baseUrl}/api/v1/user/authentication`;
            const credentials = btoa('admin:password'); // Base64 encode admin:password

            console.log('Testing authentication with admin:password to get Girder token:', { authUrl });

            const response = await fetch(authUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('Authentication response:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (response.ok) {
                const authData = await response.json();
                console.log('Authentication successful - Full auth data:', authData);

                // Extract the Girder token from the response
                const girderToken = authData?.authToken?.token;
                const userData = authData?.user;

                if (girderToken) {
                    console.log('Girder token obtained:', girderToken);

                    // Extract user info
                    const userName = userData?.login || userData?.firstName || userData?.email || 'Admin User';
                    const userId = userData?._id || userData?.id || 'Unknown ID';

                    alert(`SUCCESS! Authentication successful!\n\nUser: ${userName}\nID: ${userId}\n\nGirder token obtained and ready to use for API requests.`);

                    // Set the obtained Girder token
                    setGirderToken(girderToken);
                    console.log('Girder token set to:', girderToken);
                } else {
                    console.error('No Girder token found in response:', authData);
                    alert(`Authentication succeeded but no Girder token found in response.\n\nResponse: ${JSON.stringify(authData)}`);
                }
            } else {
                const errorText = await response.text();
                console.log('Authentication failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    response: errorText
                });
                alert(`FAILED! Authentication with admin:password failed.\n\nError: ${errorText}`);
            }
        } catch (error) {
            console.error('Error testing authentication:', error);
            alert(`Error testing authentication: ${error.message}`);
        }
    };

    const testApiDescription = async () => {
        try {
            if (!dsaConfig.baseUrl) {
                alert('Please fill in Base URL');
                return;
            }

            const describeUrl = `${dsaConfig.baseUrl}/api/v1/describe`;

            const headers = {
                'Content-Type': 'application/json'
            };

            // Use Girder token if available, otherwise try API key
            if (girderToken) {
                headers['Girder-Token'] = girderToken;
            } else if (dsaConfig.apiKey) {
                headers['Girder-Token'] = dsaConfig.apiKey;
            }

            console.log('Testing API description:', { describeUrl, headers });

            const response = await fetch(describeUrl, {
                method: 'GET',
                headers: headers
            });

            console.log('API description response:', {
                status: response.status,
                statusText: response.statusText,
                ok: response.ok
            });

            if (response.ok) {
                const apiInfo = await response.json();
                console.log('API Description:', apiInfo);

                // Extract useful information
                const info = {
                    apiVersion: apiInfo.apiVersion || 'Unknown',
                    serverInfo: apiInfo.serverInfo || {},
                    endpoints: Object.keys(apiInfo.apis || {}),
                    authentication: apiInfo.authentication || {}
                };

                alert(`API Description loaded successfully!\n\nAPI Version: ${info.apiVersion}\nAvailable endpoints: ${info.endpoints.slice(0, 10).join(', ')}${info.endpoints.length > 10 ? '...' : ''}\n\nCheck browser console for full details.`);
            } else {
                const errorText = await response.text();
                console.error('API description failed:', {
                    status: response.status,
                    statusText: response.statusText,
                    response: errorText
                });
                alert(`API description failed: ${response.status} ${response.statusText}\n\nURL: ${describeUrl}\n\nResponse: ${errorText.substring(0, 200)}...`);
            }
        } catch (error) {
            console.error('API description test failed:', error);
            alert(`API description test failed: ${error.message}`);
        }
    };



    const loadDsaConfig = () => {
        try {
            const stored = localStorage.getItem('bdsa_dsa_config');
            if (stored) {
                const config = JSON.parse(stored);
                setDsaConfig(config);
                console.log('DSA config loaded from localStorage:', config);
            }
        } catch (error) {
            console.error('Error loading DSA config:', error);
        }
    };

    const saveDsaConfig = (config) => {
        try {
            localStorage.setItem('bdsa_dsa_config', JSON.stringify(config));
            console.log('DSA config saved to localStorage:', config);
        } catch (error) {
            console.error('Error saving DSA config:', error);
        }
    };

    const handleSaveRegexRules = (newRules) => {
        setRegexRules(newRules);
        // Save to data source specific storage
        saveRegexRules(dataSource, newRules);

        // Re-apply rules to current data if available
        if (rowData.length > 0) {
            const updatedData = applyRegexRules(rowData, newRules);
            setRowData(updatedData);
        }
    };


    const loadRegexRules = () => {
        const savedRules = localStorage.getItem('dsaRegexRules');
        if (savedRules) {
            try {
                const parsedRules = JSON.parse(savedRules);
                setRegexRules(parsedRules);
            } catch (error) {
                console.error('Error loading saved regex rules:', error);
            }
        }
    };

    const loadSettingsForDataSource = (source) => {
        setColumnWidths(loadColumnWidths(source));
        setCaseIdMappings(loadCaseIdMappings(source));
        setCaseProtocolMappings(loadCaseProtocolMappings(source));

        if (source === DATA_SOURCE_TYPES.DSA) {
            setDsaConfig(loadDsaConfig());
            setRegexRules(loadRegexRules(source));
        }
    };

    const saveSettingsForDataSource = (source) => {
        saveColumnWidths(source, columnWidths);
        saveCaseIdMappings(source, caseIdMappings);
        saveCaseProtocolMappings(source, caseProtocolMappings);

        if (source === DATA_SOURCE_TYPES.DSA) {
            saveDsaConfig(dsaConfig);
            saveRegexRules(source, regexRules);
        }
    };

    const loadColumnWidths = () => {
        try {
            const stored = localStorage.getItem('bdsa_column_widths');
            console.log('Loading column widths from localStorage:', stored);
            if (stored) {
                setColumnWidths(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading column widths:', error);
        }
    };

    const loadCaseIdMappings = () => {
        try {
            const stored = localStorage.getItem('bdsa_case_id_mappings');
            if (stored) {
                setCaseIdMappings(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading case ID mappings:', error);
        }
    };

    const loadCaseProtocolMappings = () => {
        try {
            const stored = localStorage.getItem('bdsa_case_mappings');
            if (stored) {
                const mappings = JSON.parse(stored);
                setCaseProtocolMappings(mappings);
                console.log('Protocol mappings loaded:', mappings);
            }
        } catch (error) {
            console.error('Error loading case protocol mappings:', error);
        }
    };

    const loadStainProtocols = () => {
        try {
            const stored = localStorage.getItem('bdsa_stain_protocols');
            if (stored) {
                setStainProtocols(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading stain protocols:', error);
        }
    };

    const loadRegionProtocols = () => {
        try {
            const stored = localStorage.getItem('bdsa_region_protocols');
            if (stored) {
                setRegionProtocols(JSON.parse(stored));
            }
        } catch (error) {
            console.error('Error loading region protocols:', error);
        }
    };

    const saveColumnWidths = (widths) => {
        try {
            localStorage.setItem('bdsa_column_widths', JSON.stringify(widths));
            setColumnWidths(widths);
        } catch (error) {
            console.error('Error saving column widths:', error);
        }
    };







    const handleColumnVisibilityChange = useCallback((hiddenCols) => {
        setHiddenColumns(hiddenCols);
    }, []);

    const handleColumnMappingChange = useCallback((mapping) => {
        setColumnMapping(mapping);
    }, []);

    const handleColumnOrderChange = useCallback((order) => {
        setColumnOrder(order);
    }, []);

    const handleColumnResized = useCallback((event) => {
        if (!event.columnApi) return;

        const newWidths = { ...columnWidths };
        event.columnApi.getAllDisplayedColumns().forEach(col => {
            newWidths[col.getColId()] = col.getActualWidth();
        });
        saveColumnWidths(newWidths);
    }, [columnWidths]);

    const getDisplayName = (fieldName) => {
        if (fieldName.startsWith('meta.')) {
            return fieldName.substring(5); // Remove 'meta.' prefix
        }
        return fieldName;
    };

    const handleGridReady = useCallback((params) => {
        // Set title attributes for column headers
        setTimeout(() => {
            const headerTexts = document.querySelectorAll('.ag-header-cell-text');
            headerTexts.forEach(headerText => {
                const fullText = headerText.textContent || headerText.innerText;
                headerText.setAttribute('title', fullText);
            });
        }, 100);
    }, []);



    const handleThemeChange = (event) => {
        setGridTheme(event.target.value);
    };

    const generateBdsaCaseId = (localCaseId) => {
        if (!localCaseId || !bdsaInstitutionId) return '';

        // Only return BDSA case ID if we have a stored mapping
        if (caseIdMappings && caseIdMappings[localCaseId]) {
            return caseIdMappings[localCaseId];
        }

        // Return empty string for unmapped cases
        return '';
    };







    const getVisibleColumns = () => {
        // Map of mapping keys to display names
        const mappingLabels = {
            localCaseId: 'localCaseID',
            localStainID: 'localStainID',
            localRegionId: 'localRegionID'
        };
        // Build an array of { field, label } for mapped columns, in the desired order
        const mappedColumnsInfo = [
            { field: columnMapping.localCaseId, label: mappingLabels.localCaseId },
            { field: columnMapping.localStainID, label: mappingLabels.localStainID },
            { field: columnMapping.localRegionId, label: mappingLabels.localRegionId }
        ].filter(item => item.field);

        // Remove duplicates and hidden columns
        const mappedColumns = mappedColumnsInfo
            .filter((item, idx, arr) => arr.findIndex(i => i.field === item.field) === idx)
            .map(item => {
                const col = columnDefs.find(col => col.field === item.field);
                if (!col || hiddenColumns.includes(col.field)) return null;
                // Override headerName for mapped columns and set smaller width
                const savedWidth = (columnWidths || {})[item.field];
                return {
                    ...col,
                    headerName: item.label,
                    minWidth: 140,
                    width: savedWidth || 140,

                };
            })
            .filter(Boolean);

        // Add BDSA Case ID column if local case ID is mapped
        let bdsaCaseIdColumn = null;
        if (columnMapping.localCaseId) {
            const savedWidth = (columnWidths || {})['bdsa_case_id'];
            bdsaCaseIdColumn = {
                field: 'bdsa_case_id',
                headerName: 'BDSA Case ID',
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 150,
                width: savedWidth || 150,
                valueGetter: (params) => {
                    const localCaseId = params.data[columnMapping.localCaseId];
                    return generateBdsaCaseId(localCaseId);
                },
                cellStyle: (params) => {
                    const localCaseId = params.data[columnMapping.localCaseId];
                    // Check if this local case ID has been manually mapped
                    if (localCaseId && (caseIdMappings || {})[localCaseId]) {
                        return { backgroundColor: '#d4edda', color: '#155724' };
                    }
                    return { backgroundColor: '#f8d7da', color: '#721c24' }; // Red background for unmapped
                }
            };
        }

        // Add Stain Protocols column
        let stainProtocolsColumn = null;
        if (columnMapping.localCaseId && columnMapping.localStainID) {
            const savedWidth = (columnWidths || {})['stain_protocols'];
            stainProtocolsColumn = {
                field: 'stain_protocols',
                headerName: 'Stain Protocols',
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 120,
                width: savedWidth || 120,
                valueGetter: (params) => {
                    const localCaseId = params.data[columnMapping.localCaseId];
                    const filename = params.data['name'];

                    if (!localCaseId || !filename) return 0;

                    const bdsaCaseId = (caseIdMappings || {})[localCaseId];
                    if (!bdsaCaseId) return 0;

                    const slideId = `${bdsaCaseId}_${filename}`;
                    const protocols = (caseProtocolMappings || {})[bdsaCaseId]?.[slideId] || [];

                    return Array.isArray(protocols) ? protocols.length : 0;
                },
                cellRenderer: (params) => {
                    const count = params.value;
                    if (count === 0) return '0';

                    const localCaseId = params.data[columnMapping.localCaseId];
                    const filename = params.data['name'];
                    const bdsaCaseId = (caseIdMappings || {})[localCaseId];
                    const slideId = `${bdsaCaseId}_${filename}`;
                    const protocols = (caseProtocolMappings || {})[bdsaCaseId]?.[slideId] || [];

                    // Check if IGNORE protocol is present
                    const hasIgnore = protocols.includes('ignore');
                    const activeProtocols = protocols.filter(p => p !== 'ignore');

                    // Create tooltip with protocol names
                    const protocolNames = protocols.map(id => {
                        const protocol = stainProtocols.find(p => p.id === id);
                        return protocol ? protocol.name || protocol.id : `Protocol ${id}`;
                    }).join(', ');

                    if (hasIgnore) {
                        return (
                            <div
                                title={`Mapped protocols: ${protocolNames}`}
                                style={{
                                    cursor: 'help',
                                    fontWeight: 'bold',
                                    color: '#dc3545'
                                }}
                            >
                                IGNORE
                                {activeProtocols.length > 0 && (
                                    <span style={{ color: '#6c757d', marginLeft: '4px' }}>
                                        (+{activeProtocols.length})
                                    </span>
                                )}
                            </div>
                        );
                    }

                    return (
                        <div
                            title={`Mapped protocols: ${protocolNames}`}
                            style={{
                                cursor: 'help',
                                fontWeight: 'bold',
                                color: count > 0 ? '#28a745' : '#6c757d'
                            }}
                        >
                            {count}
                        </div>
                    );
                },
                cellStyle: (params) => {
                    const count = params.value;
                    if (count === 0) {
                        return { backgroundColor: '#f8f9fa', color: '#6c757d' };
                    }

                    // Check if IGNORE protocol is present
                    const localCaseId = params.data[columnMapping.localCaseId];
                    const filename = params.data['name'];
                    const bdsaCaseId = (caseIdMappings || {})[localCaseId];
                    const slideId = `${bdsaCaseId}_${filename}`;
                    const protocols = (caseProtocolMappings || {})[bdsaCaseId]?.[slideId] || [];
                    const hasIgnore = protocols.includes('ignore');

                    if (hasIgnore) {
                        return { backgroundColor: '#f8d7da', color: '#721c24' }; // Red for ignored
                    } else if (count === 1) {
                        return { backgroundColor: '#d4edda', color: '#155724' }; // Green for single protocol
                    } else {
                        return { backgroundColor: '#cce5ff', color: '#004085' }; // Blue for multiple protocols
                    }
                }
            };
        }

        // Add Region Protocols column
        let regionProtocolsColumn = null;
        if (columnMapping.localCaseId && columnMapping.localRegionId) {
            const savedWidth = (columnWidths || {})['region_protocols'];
            regionProtocolsColumn = {
                field: 'region_protocols',
                headerName: 'Region Protocols',
                sortable: true,
                filter: true,
                resizable: true,
                minWidth: 120,
                width: savedWidth || 120,
                valueGetter: (params) => {
                    const localCaseId = params.data[columnMapping.localCaseId];
                    const filename = params.data['name'];

                    if (!localCaseId || !filename) return 0;

                    const bdsaCaseId = (caseIdMappings || {})[localCaseId];
                    if (!bdsaCaseId) return 0;

                    const slideId = `${bdsaCaseId}_${filename}`;
                    const protocols = (caseProtocolMappings || {})[bdsaCaseId]?.[slideId] || [];

                    return Array.isArray(protocols) ? protocols.length : 0;
                },
                cellRenderer: (params) => {
                    const count = params.value;
                    if (count === 0) return '0';

                    const localCaseId = params.data[columnMapping.localCaseId];
                    const filename = params.data['name'];
                    const bdsaCaseId = (caseIdMappings || {})[localCaseId];
                    const slideId = `${bdsaCaseId}_${filename}`;
                    const protocols = (caseProtocolMappings || {})[bdsaCaseId]?.[slideId] || [];

                    // Check if IGNORE protocol is present
                    const hasIgnore = protocols.includes('ignore');
                    const activeProtocols = protocols.filter(p => p !== 'ignore');

                    // Create tooltip with protocol names
                    const protocolNames = protocols.map(id => {
                        const protocol = regionProtocols.find(p => p.id === id);
                        return protocol ? protocol.name || protocol.id : `Protocol ${id}`;
                    }).join(', ');

                    if (hasIgnore) {
                        return (
                            <div
                                title={`Mapped protocols: ${protocolNames}`}
                                style={{
                                    cursor: 'help',
                                    fontWeight: 'bold',
                                    color: '#dc3545'
                                }}
                            >
                                IGNORE
                                {activeProtocols.length > 0 && (
                                    <span style={{ color: '#6c757d', marginLeft: '4px' }}>
                                        (+{activeProtocols.length})
                                    </span>
                                )}
                            </div>
                        );
                    }

                    return (
                        <div
                            title={`Mapped protocols: ${protocolNames}`}
                            style={{
                                cursor: 'help',
                                fontWeight: 'bold',
                                color: count > 0 ? '#28a745' : '#6c757d'
                            }}
                        >
                            {count}
                        </div>
                    );
                },
                cellStyle: (params) => {
                    const count = params.value;
                    if (count === 0) {
                        return { backgroundColor: '#f8f9fa', color: '#6c757d' };
                    }

                    // Check if IGNORE protocol is present
                    const localCaseId = params.data[columnMapping.localCaseId];
                    const filename = params.data['name'];
                    const bdsaCaseId = (caseIdMappings || {})[localCaseId];
                    const slideId = `${bdsaCaseId}_${filename}`;
                    const protocols = (caseProtocolMappings || {})[bdsaCaseId]?.[slideId] || [];
                    const hasIgnore = protocols.includes('ignore');

                    if (hasIgnore) {
                        return { backgroundColor: '#f8d7da', color: '#721c24' }; // Red for ignored
                    } else if (count === 1) {
                        return { backgroundColor: '#d4edda', color: '#155724' }; // Green for single protocol
                    } else {
                        return { backgroundColor: '#cce5ff', color: '#004085' }; // Blue for multiple protocols
                    }
                }
            };
        }

        // All other columns, excluding mapped and hidden
        const mappedSet = new Set(mappedColumnsInfo.map(item => item.field));
        const otherColumns = (columnDefs || []).filter(
            col => !mappedSet.has(col.field) && !hiddenColumns.includes(col.field)
        ).map(col => {
            const savedWidth = (columnWidths || {})[col.field];
            return {
                ...col,
                headerName: getDisplayName(col.field),
                width: savedWidth || col.width || 150,

            };
        });

        // Apply custom column order if available
        if (columnOrder.length > 0) {
            const orderedColumns = [];
            const processedFields = new Set();

            // Add BDSA Case ID first if it exists
            if (bdsaCaseIdColumn) {
                orderedColumns.push(bdsaCaseIdColumn);
                processedFields.add('bdsa_case_id');
            }

            // Add Stain Protocols column if it exists
            if (stainProtocolsColumn) {
                orderedColumns.push(stainProtocolsColumn);
                processedFields.add('stain_protocols');
            }

            // Add Region Protocols column if it exists
            if (regionProtocolsColumn) {
                orderedColumns.push(regionProtocolsColumn);
                processedFields.add('region_protocols');
            }

            // Add mapped columns in order
            mappedColumns.forEach(col => {
                orderedColumns.push(col);
                processedFields.add(col.field);
            });

            // Add remaining columns in custom order
            columnOrder.forEach(field => {
                if (!processedFields.has(field) && !hiddenColumns.includes(field)) {
                    const col = otherColumns.find(c => c.field === field);
                    if (col) {
                        orderedColumns.push(col);
                        processedFields.add(field);
                    }
                }
            });

            // Add any remaining columns that weren't in the order
            otherColumns.forEach(col => {
                if (!processedFields.has(col.field)) {
                    orderedColumns.push(col);
                }
            });

            return orderedColumns;
        }

        // Return BDSA Case ID first, then Stain Protocols, then Region Protocols, then mapped columns, then the rest (default behavior)
        const result = [];
        if (bdsaCaseIdColumn) {
            result.push(bdsaCaseIdColumn);
        }
        if (stainProtocolsColumn) {
            result.push(stainProtocolsColumn);
        }
        if (regionProtocolsColumn) {
            result.push(regionProtocolsColumn);
        }
        result.push(...mappedColumns);
        result.push(...otherColumns);

        return result;
    };

    if (loading || !isInitialized) {
        return <div className="loading">Loading data...</div>;
    }

    return (
        <div className="input-data-tab">
            <div className="controls-row">
                <div className="data-source-selector">
                    <label htmlFor="data-source">Data Source:</label>
                    <select
                        id="data-source"
                        value={dataSource}
                        onChange={(e) => {
                            handleDataSourceChange(e.target.value);
                            // Clear data when switching to DSA to ensure fresh start
                            if (e.target.value === 'dsa') {
                                setRowData([]);
                                setColumnDefs([]);
                            }
                        }}
                        className="data-source-dropdown"
                    >
                        <option value="csv">CSV File</option>
                        <option value="dsa">Digital Slide Archive</option>
                    </select>
                    {dataSource === 'dsa' && (
                        <>
                            <button
                                className="dsa-config-btn"
                                onClick={() => setShowDsaConfig(true)}
                            >
                                Configure DSA
                            </button>
                            <button
                                className="load-dsa-data-btn"
                                onClick={() => loadDsaData()}
                                disabled={!dsaConfig?.baseUrl || !dsaConfig?.resourceId || !girderToken}
                            >
                                Load DSA Data
                            </button>
                            <button
                                className="regex-rules-btn"
                                onClick={() => setShowRegexRules(true)}
                            >
                                Regex Rules
                            </button>
                        </>
                    )}
                </div>

                <ColumnControl
                    allColumns={columnDefs.map(col => col.field)}
                    rowData={rowData}
                    onColumnVisibilityChange={handleColumnVisibilityChange}
                    onColumnMappingChange={handleColumnMappingChange}
                    onColumnOrderChange={handleColumnOrderChange}
                />

                <button
                    className="bdsa-settings-btn"
                    onClick={() => setShowBdsaSettings(true)}
                >
                    BDSA Settings
                </button>

                <button
                    className="export-btn"
                    onClick={exportEnrichedData}
                    disabled={rowData.length === 0}
                >
                    Export Enriched Data
                </button>

                <div className="theme-selector">
                    <label htmlFor="grid-theme">Grid Theme:</label>
                    <select
                        id="grid-theme"
                        value={gridTheme}
                        onChange={handleThemeChange}
                        className="theme-dropdown"
                    >
                        <option value="alpine">Alpine</option>
                        <option value="balham">Balham</option>
                        <option value="material">Material</option>
                        <option value="quartz">Quartz</option>
                    </select>
                </div>
            </div>

            {/* BDSA Settings Modal */}
            {showBdsaSettings && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>BDSA Settings</h2>
                        <div className="bdsa-settings-form">
                            <div className="form-group">
                                <label htmlFor="bdsa-institution-id">BDSA Institution ID:</label>
                                <input
                                    type="text"
                                    id="bdsa-institution-id"
                                    value={bdsaInstitutionId}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        // Only allow 3 digits
                                        if (/^\d{0,3}$/.test(value)) {
                                            setBdsaInstitutionId(value.padStart(3, '0'));
                                        }
                                    }}
                                    placeholder="001"
                                    maxLength={3}
                                />
                                <small>3-digit institution ID (e.g., 001, 002, etc.)</small>
                            </div>


                        </div>
                        <button
                            className="close-modal-btn"
                            onClick={() => setShowBdsaSettings(false)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* DSA Configuration Modal */}
            {showDsaConfig && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>Digital Slide Archive Configuration</h2>
                        <div className="dsa-settings-form">
                            <div className="form-group">
                                <label htmlFor="dsa-base-url">Base URL:</label>
                                <input
                                    type="url"
                                    id="dsa-base-url"
                                    value={dsaConfig?.baseUrl || ''}
                                    onChange={(e) => {
                                        const newConfig = { ...(dsaConfig || {}), baseUrl: e.target.value };
                                        setDsaConfig(newConfig);
                                        saveDsaConfig(newConfig);
                                    }}
                                    placeholder="https://your-dsa-instance.com"
                                />
                                <small>Base URL of your Digital Slide Archive instance</small>
                            </div>
                            <div className="form-group">
                                <label htmlFor="dsa-resource-type">Resource Type:</label>
                                <select
                                    id="dsa-resource-type"
                                    value={dsaConfig?.resourceType || 'folder'}
                                    onChange={(e) => {
                                        const newConfig = { ...(dsaConfig || {}), resourceType: e.target.value };
                                        setDsaConfig(newConfig);
                                        saveDsaConfig(newConfig);
                                    }}
                                    className="resource-type-dropdown"
                                >
                                    <option value="collection">Collection</option>
                                    <option value="folder">Folder</option>
                                </select>
                                <small>Type of resource to pull items from</small>
                            </div>
                            <div className="form-group">
                                <label htmlFor="dsa-resource-id">Resource ID:</label>
                                <input
                                    type="text"
                                    id="dsa-resource-id"
                                    value={dsaConfig?.resourceId || ''}
                                    onChange={(e) => {
                                        const newConfig = { ...(dsaConfig || {}), resourceId: e.target.value };
                                        setDsaConfig(newConfig);
                                        saveDsaConfig(newConfig);
                                    }}
                                    placeholder="resource-id"
                                />
                                <small>ID of the {dsaConfig?.resourceType || 'folder'} to pull items from</small>
                                <div style={{ marginTop: '8px', padding: '8px', backgroundColor: '#fff3cd', color: '#856404', borderRadius: '4px', fontSize: '0.8rem' }}>
                                    <strong>Note:</strong> If you get "Read access denied" errors, the resource may be private and require specific permissions. Try using a public collection or contact the DSA administrator.
                                </div>
                            </div>
                            <div className="form-group">
                                <label>Authentication:</label>
                                <div style={{ padding: '8px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px', fontSize: '0.9rem' }}>
                                    <strong>Using admin:password authentication</strong><br />
                                    <small>This will automatically obtain a Girder token for API access.</small>
                                </div>
                                {girderToken && (
                                    <div style={{ marginTop: '8px', padding: '4px 8px', backgroundColor: '#d4edda', color: '#155724', borderRadius: '4px', fontSize: '0.8rem' }}>
                                        ✓ Girder token obtained: {girderToken.substring(0, 20)}...
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-buttons">
                            <button
                                className="test-direct-token-btn"
                                onClick={() => testDirectToken()}
                                disabled={!dsaConfig?.baseUrl}
                            >
                                Get Girder Token
                            </button>
                            <button
                                className="test-resource-access-btn"
                                onClick={() => testResourceAccess()}
                                disabled={!dsaConfig?.baseUrl || !dsaConfig?.resourceId || !girderToken}
                            >
                                Test Resource Access
                            </button>
                            <button
                                className="close-modal-btn"
                                onClick={() => setShowDsaConfig(false)}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Regex Rules Modal */}
            <RegexRulesModal
                isOpen={showRegexRules}
                onClose={() => setShowRegexRules(false)}
                onSave={handleSaveRegexRules}
                currentRules={regexRules}
                sampleData={rowData}
            />

            <div className="grid-container">
                <AgGridReact
                    rowData={rowData}
                    columnDefs={getVisibleColumns()}
                    pagination={true}
                    paginationPageSize={25}
                    domLayout="normal"
                    theme="legacy"
                    className={`ag-theme-${gridTheme}`}
                    suppressFieldDotNotation={true}
                    onColumnResized={handleColumnResized}
                    onGridReady={handleGridReady}
                    enableTooltip={true}
                    tooltipShowDelay={0}
                    defaultColDef={{
                        sortable: true,
                        filter: true,
                        resizable: true
                    }}
                />
            </div>
        </div>
    );
};

export default InputDataTab; 