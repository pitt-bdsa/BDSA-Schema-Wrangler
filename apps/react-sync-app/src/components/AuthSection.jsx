import React from 'react';

const AuthSection = ({ 
  authStatus, 
  isLoading, 
  onAuthenticate, 
  onLogout, 
  config 
}) => {
  return (
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
            disabled={isLoading}
            className="logout-btn"
          >
            Logout
          </button>
        </div>
      ) : (
        <div className="auth-form">
          <h4>Authentication</h4>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const username = formData.get('username');
            const password = formData.get('password');
            if (username && password) {
              onAuthenticate(username, password);
            }
          }}>
            <label>
              Username:
              <input
                type="text"
                name="username"
                required
                disabled={isLoading}
              />
            </label>

            <label>
              Password:
              <input
                type="password"
                name="password"
                required
                disabled={isLoading}
              />
            </label>

            <button
              type="submit"
              disabled={isLoading || !config.baseUrl}
            >
              {isLoading ? 'Authenticating...' : 'Login'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default AuthSection;
