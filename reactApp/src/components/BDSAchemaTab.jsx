import React from 'react';
import SchemaTabView from './SchemaTabView';
import ClinicalSchemaTab from './ClinicalSchemaTab';
import RegionSchemaTab from './RegionSchemaTab';
import StainSchemaTab from './StainSchemaTab';
import './BDSAchemaTab.css';

const BDSAchemaTab = () => {
    return (
        <div className="bdsa-schema-tab">
            <div className="schema-content">
                <SchemaTabView>
                    <ClinicalSchemaTab />
                    <RegionSchemaTab />
                    <StainSchemaTab />
                </SchemaTabView>
            </div>
        </div>
    );
};

export default BDSAchemaTab; 