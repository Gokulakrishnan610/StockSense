import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '../services/api';

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
  }, [pathname]);

  return counts;
}
