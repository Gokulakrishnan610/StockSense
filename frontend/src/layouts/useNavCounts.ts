import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api';

const CHANGED_EVENT = 'stocksense:operations-changed';

/** Call after an operation changes status so the sidebar badges refresh immediately. */
export const notifyOperationsChanged = () => window.dispatchEvent(new Event(CHANGED_EVENT));

export interface NavCounts {
  receipts?: number;
  deliveries?: number;
  transfers?: number;
  adjustments?: number;
  warehouses?: number;
  locations?: number;
}

/**
 * Badge counts for the sidebar: open (not Done/Canceled) operations and the
 * number of configured warehouses and locations. Refreshed on every page change
 * so the badges follow the user's own actions.
 */
export function useNavCounts(): NavCounts {
  const { pathname } = useLocation();
  const [counts, setCounts] = useState<NavCounts>({});
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    window.addEventListener(CHANGED_EVENT, bump);
    return () => window.removeEventListener(CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.getOperationSummary(),
      api.getWarehouses(0, 100),
      api.getLocations(undefined, 0, 100),
    ])
      .then(([summary, warehouses, locations]) => {
        if (!active) return;
        const open = (c: Record<string, number>) => c.DRAFT + c.WAITING + c.READY;
        setCounts({
          receipts: open(summary.receipts),
          deliveries: open(summary.deliveries),
          transfers: open(summary.transfers),
          adjustments: summary.adjustments.DRAFT,
          warehouses: warehouses.length,
          locations: locations.length,
        });
      })
      .catch(() => {
        // Badges are informational; navigation keeps working without them.
      });
    return () => {
      active = false;
    };
  }, [pathname, version]);

  return counts;
}
