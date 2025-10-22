import React from 'react';
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
export declare const DSAConfigForm: React.FC<DSAConfigFormProps>;
export {};
