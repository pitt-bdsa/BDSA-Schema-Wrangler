import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
export const DSAConfigForm = ({ config, authStatus, onConfigChange, onAuthenticate, onTestConnection, onLogout, disabled = false, }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isTestingConnection, setIsTestingConnection] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('');
    const handleConfigChange = (field, value) => {
        onConfigChange({
            ...config,
            [field]: value,
        });
    };
    const handleAuthenticate = async (e) => {
        e.preventDefault();
        if (!username || !password)
            return;
        setIsAuthenticating(true);
        try {
            await onAuthenticate(username, password);
            setPassword(''); // Clear password after successful auth
        }
        catch (error) {
            console.error('Authentication failed:', error);
        }
        finally {
            setIsAuthenticating(false);
        }
    };
    const handleTestConnection = async () => {
        setIsTestingConnection(true);
        setConnectionStatus('');
        try {
            await onTestConnection();
            setConnectionStatus('Connection successful!');
        }
        catch (error) {
            setConnectionStatus(`Connection failed: ${error.message}`);
        }
        finally {
            setIsTestingConnection(false);
        }
    };
    return (_jsxs("div", { className: "dsa-config-form", children: [_jsx("h3", { children: "DSA Server Configuration" }), _jsxs("div", { className: "config-section", children: [_jsxs("label", { children: ["Server URL:", _jsx("input", { type: "url", value: config.baseUrl, onChange: (e) => handleConfigChange('baseUrl', e.target.value), placeholder: "https://your-dsa-server.com", disabled: disabled })] }), _jsxs("label", { children: ["Resource ID:", _jsx("input", { type: "text", value: config.resourceId, onChange: (e) => handleConfigChange('resourceId', e.target.value), placeholder: "Folder or collection ID", disabled: disabled })] }), _jsxs("label", { children: ["Resource Type:", _jsxs("select", { value: config.resourceType || 'folder', onChange: (e) => handleConfigChange('resourceType', e.target.value), disabled: disabled, children: [_jsx("option", { value: "folder", children: "Folder" }), _jsx("option", { value: "collection", children: "Collection" })] })] })] }), _jsxs("div", { className: "connection-section", children: [_jsx("button", { type: "button", onClick: handleTestConnection, disabled: disabled || !config.baseUrl || isTestingConnection, children: isTestingConnection ? 'Testing...' : 'Test Connection' }), connectionStatus && (_jsx("div", { className: `connection-status ${connectionStatus.includes('successful') ? 'success' : 'error'}`, children: connectionStatus }))] }), authStatus.isConfigured && (_jsx("div", { className: "auth-section", children: authStatus.isAuthenticated ? (_jsxs("div", { className: "auth-status authenticated", children: [_jsxs("p", { children: ["\u2705 Authenticated as: ", authStatus.user?.name || 'Unknown User'] }), _jsxs("p", { children: ["Server: ", authStatus.serverUrl] }), authStatus.lastLogin && (_jsxs("p", { children: ["Last login: ", new Date(authStatus.lastLogin).toLocaleString()] })), _jsx("button", { type: "button", onClick: onLogout, disabled: disabled, className: "logout-btn", children: "Logout" })] })) : (_jsxs("form", { onSubmit: handleAuthenticate, className: "auth-form", children: [_jsx("h4", { children: "Authentication" }), _jsxs("label", { children: ["Username:", _jsx("input", { type: "text", value: username, onChange: (e) => setUsername(e.target.value), disabled: disabled || isAuthenticating, required: true })] }), _jsxs("label", { children: ["Password:", _jsx("input", { type: "password", value: password, onChange: (e) => setPassword(e.target.value), disabled: disabled || isAuthenticating, required: true })] }), _jsx("button", { type: "submit", disabled: disabled || isAuthenticating || !username || !password, children: isAuthenticating ? 'Authenticating...' : 'Login' })] })) }))] }));
};
