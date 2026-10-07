import { useEffect, useState } from 'react';
import {
    ensureProtocolsLoaded,
    getProtocols,
    subscribeProtocols,
} from '../utils/protocolSource';

export default function useProtocolList(type = 'stain') {
    const [protocols, setProtocols] = useState(() => getProtocols(type) || []);

    useEffect(() => {
        const sync = () => setProtocols(getProtocols(type) || []);
        sync();
        const unsubscribe = subscribeProtocols(sync);
        ensureProtocolsLoaded().then(sync).catch(() => {});
        return unsubscribe;
    }, [type]);

    return protocols;
}
