import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, House } from '../components/ui/icons';
import { DOC_KINDS, docRef, type DocKind } from '../pages/operations/operationUtils';

interface Crumb {
  label: string;
  to?: string;
}

const SIMPLE: Record<string, Crumb[]> = {
  dashboard: [{ label: 'Overview' }, { label: 'Dashboard' }],
  products: [{ label: 'Inventory' }, { label: 'Products' }],
  categories: [{ label: 'Inventory' }, { label: 'Categories' }],
  'reordering-rules': [{ label: 'Inventory' }, { label: 'Reordering Rules' }],
  locations: [{ label: 'Configuration' }, { label: 'Locations' }],
  profile: [{ label: 'Profile & Account' }],
};

const OPERATION_SEGMENTS: Record<string, DocKind> = {
  receipts: 'receipt',
  deliveries: 'delivery',
  transfers: 'transfer',
  adjustments: 'adjustment',
};

function crumbsFor(pathname: string): Crumb[] {
  const [section, sub, id, action] = pathname.split('/').filter(Boolean);
  if (!section) return [];
  if (SIMPLE[section]) return SIMPLE[section];

  if (section === 'warehouses') {
    const list: Crumb = { label: 'Warehouses', to: '/warehouses' };
    return sub
      ? [{ label: 'Configuration' }, list, { label: 'Warehouse Details' }]
      : [{ label: 'Configuration' }, { label: 'Warehouses' }];
  }

  if (section === 'operations') {
    if (sub === 'move-history') return [{ label: 'Operations' }, { label: 'Move History' }];
    const kind = OPERATION_SEGMENTS[sub];
    if (!kind) return [{ label: 'Operations' }];
    const meta = DOC_KINDS[kind];
    const crumbs: Crumb[] = [{ label: 'Operations' }, { label: meta.plural, to: meta.path }];
    if (id === 'new') crumbs.push({ label: `New ${meta.label}` });
    else if (id && action === 'edit') {
      crumbs.push({ label: docRef(kind, id), to: `${meta.path}/${id}` }, { label: 'Edit' });
    } else if (id) crumbs.push({ label: docRef(kind, id) });
    return crumbs;
  }
  return [];
}

export function Breadcrumbs() {
  const { pathname } = useLocation();
  const crumbs = crumbsFor(pathname);
  if (!crumbs.length) return null;
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <Link to="/dashboard" aria-label="Home">
        <House size={14} />
      </Link>
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <Fragment key={`${crumb.label}-${index}`}>
            <ChevronRight size={12} />
            {last ? (
              <span className="current" aria-current="page">{crumb.label}</span>
            ) : crumb.to ? (
              <Link to={crumb.to}>{crumb.label}</Link>
            ) : (
              <span>{crumb.label}</span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
