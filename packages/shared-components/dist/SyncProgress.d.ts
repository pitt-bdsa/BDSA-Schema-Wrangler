import React from 'react';
import { SyncProgress as SyncProgressType } from '@bdsa/shared-types';
interface SyncProgressProps {
    progress: SyncProgressType;
    onCancel?: () => void;
    showDetails?: boolean;
}
export declare const SyncProgress: React.FC<SyncProgressProps>;
export {};
