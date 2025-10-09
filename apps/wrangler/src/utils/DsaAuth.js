/**
 * DSA Authentication Utilities
 * Handles DSA authentication and resource access testing
 */

/**
 * Tests DSA authentication using admin:password credentials
 * @param {string} baseUrl - DSA base URL
 * @returns {Promise<Object>} Authentication result with token and user info
 */
export const testDirectToken = async (baseUrl) => {
    try {
        if (!baseUrl) {
            throw new Error('Please fill in Base URL first.');
        }

        // Use HTTP Basic Auth with admin:password to get a proper Girder token
        const authUrl = `${baseUrl}/api/v1/user/authentication`;
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

                return {
                    success: true,
                    token: girderToken,
                    user: {
                        name: userName,
                        id: userId,
                        data: userData
                    },
                    message: `SUCCESS! Authentication successful!\n\nUser: ${userName}\nID: ${userId}\n\nGirder token obtained and ready to use for API requests.`
                };
            } else {
                console.error('No Girder token found in response:', authData);
                return {
                    success: false,
                    error: `Authentication succeeded but no Girder token found in response.\n\nResponse: ${JSON.stringify(authData)}`
                };
            }
        } else {
            const errorText = await response.text();
            console.log('Authentication failed:', {
                status: response.status,
                statusText: response.statusText,
                response: errorText
            });
            return {
                success: false,
                error: `FAILED! Authentication with admin:password failed.\n\nError: ${errorText}`
            };
        }
    } catch (error) {
        console.error('Error testing authentication:', error);
        return {
            success: false,
            error: `Error testing authentication: ${error.message}`
        };
    }
};

/**
 * Tests access to a specific DSA resource
 * @param {string} baseUrl - DSA base URL
 * @param {string} resourceId - Resource ID to test
 * @param {string} girderToken - Authentication token
 * @returns {Promise<Object>} Resource access test result
 */
export const testResourceAccess = async (baseUrl, resourceId, girderToken) => {
    try {
        if (!baseUrl || !resourceId) {
            throw new Error('Please fill in Base URL and Resource ID first.');
        }

        if (!girderToken) {
            throw new Error('No Girder token available! Please click "Get Girder Token" first to authenticate.');
        }

        const testUrl = `${baseUrl}/api/v1/resource/${resourceId}`;
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
            return {
                success: true,
                data: resourceData,
                message: `SUCCESS! You have access to this resource.\n\nResource Name: ${resourceData.name || 'Unknown'}\nResource Type: ${resourceData._modelType || 'Unknown'}\nResource ID: ${resourceData._id || 'Unknown'}`
            };
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
                    return {
                        success: false,
                        error: `FAILED! You do not have read access to this resource.\n\nThis could mean:\n1. The resource ID is incorrect\n2. The resource is private and requires specific permissions\n3. The resource type (collection/folder) is wrong\n\nError: ${errorText}\n\nTry using a public collection or check with the DSA administrator.`
                    };
                } else {
                    return {
                        success: false,
                        error: `FAILED! You do not have access to this resource.\n\nError: ${errorText}`
                    };
                }
            } catch (parseError) {
                return {
                    success: false,
                    error: `FAILED! You do not have access to this resource.\n\nError: ${errorText}`
                };
            }
        }
    } catch (error) {
        console.error('Error testing resource access:', error);
        return {
            success: false,
            error: `Error testing resource access: ${error.message}`
        };
    }
};
