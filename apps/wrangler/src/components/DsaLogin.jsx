import React, { useState, useEffect } from 'react';
import DsaConfigModal from './DsaConfigModal';
import dsaAuthStore from '../utils/dsaAuthStore';
import './DsaLogin.css';

const DsaLogin = () => {
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [authStatus, setAuthStatus] = useState(dsaAuthStore.getStatus());
    const [loginForm, setLoginForm] = useState({ username: '', password: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const unsubscribe = dsaAuthStore.subscribe(() => {
            setAuthStatus(dsaAuthStore.getStatus());
        });

        // Validate token on mount
        if (authStatus.isAuthenticated) {
            dsaAuthStore.validateToken();
        }

        return unsubscribe;
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await dsaAuthStore.authenticate(loginForm.username, loginForm.password);
            setShowLoginModal(false);
            setLoginForm({ username: '', password: '' });
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        dsaAuthStore.logout();
    };

    const handleConfigSave = (config) => {
        dsaAuthStore.updateConfig(config);
        setShowConfigModal(false);
    };

    const getStatusDisplay = () => {
        if (!authStatus.isConfigured) {
            return { text: 'Not Configured', className: 'status-not-configured', icon: '⚙️' };
        }
        if (!authStatus.isAuthenticated) {
            return { text: 'Not Connected', className: 'status-not-connected', icon: '🔌' };
        }
        return { text: 'Connected', className: 'status-connected', icon: '✅' };
    };

    const status = getStatusDisplay();

    return (
        <>
            <div className="dsa-login">
                <div className="dsa-status" onClick={() => setShowConfigModal(true)}>
                    <span className={`status-indicator ${status.className}`}>
                        {status.icon}
                    </span>
                    <div className="status-info">
                        <div className="status-text">{status.text}</div>
                        {authStatus.isAuthenticated && authStatus.user && (
                            <div className="user-info">
                                {authStatus.user.name}
                                {authStatus.serverUrl && (
                                    <div className="server-url">
                                        {new URL(authStatus.serverUrl).hostname}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="dsa-actions">
                    {authStatus.isAuthenticated ? (
                        <button
                            className="logout-button"
                            onClick={handleLogout}
                            title="Logout from DSA server"
                        >
                            Logout
                        </button>
                    ) : (
                        <button
                            className="login-button"
                            onClick={() => setShowLoginModal(true)}
                            disabled={!authStatus.isConfigured}
                            title={!authStatus.isConfigured ? 'Configure DSA server first' : 'Login to DSA server'}
                        >
                            Login
                        </button>
                    )}
                </div>
            </div>

            {/* Login Modal */}
            {showLoginModal && (
                <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
                    <div className="modal-content login-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Login to DSA Server</h2>
                            <button className="close-button" onClick={() => setShowLoginModal(false)}>×</button>
                        </div>

                        <form onSubmit={handleLogin} className="login-form">
                            <div className="form-group">
                                <label htmlFor="serverUrl">DSA Server URL *</label>
                                <input
                                    type="url"
                                    id="serverUrl"
                                    value={authStatus.serverUrl || ''}
                                    onChange={(e) => {
                                        const url = e.target.value;
                                        dsaAuthStore.updateConfig({ baseUrl: url });
                                    }}
                                    placeholder="http://multiplex.pathology.emory.edu:8080"
                                    required
                                />
                                <div className="field-help">
                                    The base URL of your Digital Slide Archive server
                                    <br />
                                    <small>💡 Don't include /api/v1 - it will be added automatically</small>
                                </div>
                            </div>

                            <div className="form-group">
                                <label htmlFor="username">Username</label>
                                <input
                                    type="text"
                                    id="username"
                                    value={loginForm.username}
                                    onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                                    placeholder="Enter your DSA username"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">Password</label>
                                <input
                                    type="password"
                                    id="password"
                                    value={loginForm.password}
                                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                                    placeholder="Enter your password"
                                    required
                                />
                            </div>

                            {error && (
                                <div className="error-message">
                                    {error}
                                </div>
                            )}

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="cancel-button"
                                    onClick={() => setShowLoginModal(false)}
                                    disabled={isLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="login-submit-button"
                                    disabled={isLoading || !loginForm.username || !loginForm.password}
                                >
                                    {isLoading ? 'Logging in...' : 'Login'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Configuration Modal */}
            {showConfigModal && (
                <DsaConfigModal
                    onSave={handleConfigSave}
                    onClose={() => setShowConfigModal(false)}
                />
            )}
        </>
    );
};

export default DsaLogin;
