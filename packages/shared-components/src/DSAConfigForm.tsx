import React, { useState, useEffect } from 'react';
import { DSAConfig, DSAAuthStatus } from '@bdsa/shared-types';

interface DSAConfigFormProps {
  config: DSAConfig;
  authStatus: DSAAuthStatus;
  onConfigChange: (config: DSAConfig) => void;
  onAuthenticate: (username: string, password: string) => Promise<void>;
  onTestConnection: () => Promise<void>;
  onLogout: () => void;
  disabled?: boolean;
}

export const DSAConfigForm: React.FC<DSAConfigFormProps> = ({
  config,
  authStatus,
  onConfigChange,
  onAuthenticate,
  onTestConnection,
  onLogout,
  disabled = false,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>('');

  const handleConfigChange = (field: keyof DSAConfig, value: string) => {
    onConfigChange({
      ...config,
      [field]: value,
    });
  };

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;

    setIsAuthenticating(true);
    try {
      await onAuthenticate(username, setPassword);
      setPassword(''); // Clear password after successful auth
    } catch (error) {
      console.error('Authentication failed:', error);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus('');
    try {
      await onTestConnection();
      setConnectionStatus('Connection successful!');
    } catch (error: any) {
      setConnectionStatus(`Connection failed: ${error.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  return (
    <div className="dsa-config-form">
      <h3>DSA Server Configuration</h3>
      
      <div className="config-section">
        <label>
          Server URL:
          <input
            type="url"
            value={config.baseUrl}
            onChange={(e) => handleConfigChange('baseUrl', e.target.value)}
            placeholder="https://your-dsa-server.com"
            disabled={disabled}
          />
        </label>
        
        <label>
          Resource ID:
          <input
            type="text"
            value={config.resourceId}
            onChange={(e) => handleConfigChange('resourceId', e.target.value)}
            placeholder="Folder or collection ID"
            disabled={disabled}
          />
        </label>
        
        <label>
          Resource Type:
          <select
            value={config.resourceType || 'folder'}
            onChange={(e) => handleConfigChange('resourceType', e.target.value)}
            disabled={disabled}
          >
            <option value="folder">Folder</option>
            <option value="collection">Collection</option>
          </select>
        </label>
      </div>

      <div className="connection-section">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={disabled || !config.baseUrl || isTestingConnection}
        >
          {isTestingConnection ? 'Testing...' : 'Test Connection'}
        </button>
        
        {connectionStatus && (
          <div className={`connection-status ${connectionStatus.includes('successful') ? 'success' : 'error'}`}>
            {connectionStatus}
          </div>
        )}
      </div>

      {authStatus.isConfigured && (
        <div className="auth-section">
          {authStatus.isAuthenticated ? (
            <div className="auth-status authenticated">
              <p>✅ Authenticated as: {authStatus.user?.name || 'Unknown User'}</p>
              <p>Server: {authStatus.serverUrl}</p>
              {authStatus.lastLogin && (
                <p>Last login: {new Date(authStatus.lastLogin).toLocaleString()}</p>
              )}
              <button
                type="button"
                onClick={onLogout}
                disabled={disabled}
                className="logout-btn"
              >
                Logout
              </button>
            </div>
          ) : (
            <form onSubmit={handleAuthenticate} className="auth-form">
              <h4>Authentication</h4>
              <label>
                Username:
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={disabled || isAuthenticating}
                  required
                />
              </label>
              
              <label>
                Password:
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={disabled || isAuthenticating}
                  required
                />
              </label>
              
              <button
                type="submit"
                disabled={disabled || isAuthenticating || !username || !password}
              >
                {isAuthenticating ? 'Authenticating...' : 'Login'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
