import React, { useState } from 'react';
import './ProtocolsTab.css';

const ProtocolsTab = () => {
    const [activeSubTab, setActiveSubTab] = useState('blocking');

    return (
        <div className="protocols-tab">
            <div className="protocols-header">
                <h2>Protocols</h2>
                <p>Manage blocking and staining protocols for BDSA schema compliance</p>
            </div>

            <div className="protocols-sub-tabs">
                <button
                    className={`sub-tab-btn ${activeSubTab === 'blocking' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('blocking')}
                >
                    Blocking Protocols
                </button>
                <button
                    className={`sub-tab-btn ${activeSubTab === 'staining' ? 'active' : ''}`}
                    onClick={() => setActiveSubTab('staining')}
                >
                    Stain Protocols
                </button>
            </div>

            <div className="protocols-content">
                {activeSubTab === 'blocking' && (
                    <div className="blocking-protocols">
                        <div className="protocols-section">
                            <h3>Blocking Protocols</h3>
                            <p>Define blocking protocols used in your tissue processing workflow.</p>

                            <div className="protocols-list">
                                <div className="protocol-item">
                                    <div className="protocol-header">
                                        <h4>Standard Blocking Protocol</h4>
                                        <button className="edit-protocol-btn">Edit</button>
                                    </div>
                                    <div className="protocol-details">
                                        <p><strong>Description:</strong> Standard blocking protocol using 5% normal serum</p>
                                        <p><strong>Duration:</strong> 1 hour at room temperature</p>
                                        <p><strong>Temperature:</strong> RT</p>
                                    </div>
                                </div>

                                <div className="protocol-item">
                                    <div className="protocol-header">
                                        <h4>High Stringency Blocking</h4>
                                        <button className="edit-protocol-btn">Edit</button>
                                    </div>
                                    <div className="protocol-details">
                                        <p><strong>Description:</strong> High stringency blocking with 10% BSA</p>
                                        <p><strong>Duration:</strong> 2 hours at 4°C</p>
                                        <p><strong>Temperature:</strong> 4°C</p>
                                    </div>
                                </div>

                                <button className="add-protocol-btn">
                                    + Add New Blocking Protocol
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeSubTab === 'staining' && (
                    <div className="stain-protocols">
                        <div className="protocols-section">
                            <h3>Stain Protocols</h3>
                            <p>Define staining protocols for different tissue types and targets.</p>

                            <div className="protocols-list">
                                <div className="protocol-item">
                                    <div className="protocol-header">
                                        <h4>H&E Staining</h4>
                                        <button className="edit-protocol-btn">Edit</button>
                                    </div>
                                    <div className="protocol-details">
                                        <p><strong>Description:</strong> Standard Hematoxylin and Eosin staining</p>
                                        <p><strong>Duration:</strong> 30 minutes</p>
                                        <p><strong>Target:</strong> General tissue morphology</p>
                                    </div>
                                </div>

                                <div className="protocol-item">
                                    <div className="protocol-header">
                                        <h4>IHC - Tau Protein</h4>
                                        <button className="edit-protocol-btn">Edit</button>
                                    </div>
                                    <div className="protocol-details">
                                        <p><strong>Description:</strong> Immunohistochemistry for Tau protein detection</p>
                                        <p><strong>Primary Antibody:</strong> Anti-Tau (1:1000)</p>
                                        <p><strong>Secondary:</strong> HRP-conjugated anti-rabbit</p>
                                    </div>
                                </div>

                                <div className="protocol-item">
                                    <div className="protocol-header">
                                        <h4>IHC - Beta Amyloid</h4>
                                        <button className="edit-protocol-btn">Edit</button>
                                    </div>
                                    <div className="protocol-details">
                                        <p><strong>Description:</strong> Immunohistochemistry for Beta amyloid detection</p>
                                        <p><strong>Primary Antibody:</strong> Anti-Aβ (1:500)</p>
                                        <p><strong>Secondary:</strong> HRP-conjugated anti-mouse</p>
                                    </div>
                                </div>

                                <button className="add-protocol-btn">
                                    + Add New Stain Protocol
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProtocolsTab; 