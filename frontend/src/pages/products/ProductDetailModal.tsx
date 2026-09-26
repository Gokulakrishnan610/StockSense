import React, { useEffect, useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import type { Product, ProductStock, Location, Warehouse } from '../../types';
import { api } from '../../services/api';
import { LoadingState } from '../../components/ui/LoadingState';
import { MapPin, Warehouse as WarehouseIcon, Package } from '../../components/ui/icons';
import { ProductMovements } from '../operations/ProductMovements';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  product,
}) => {
  const [loading, setLoading] = useState(false);
  const [stockRows, setStockRows] = useState<ProductStock[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  useEffect(() => {
    if (isOpen && product) {
      setLoading(true);
      Promise.all([
        api.getProductStock(product.id),
        api.getWarehouses(),
        api.getLocations(),
      ])
        .then(([stockData, whData, locData]) => {
          setStockRows(stockData);
          setWarehouses(whData);
          setLocations(locData);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen, product]);

  if (!product) return null;

  const totalQuantity = stockRows.reduce((acc, row) => acc + parseFloat(row.quantity || '0'), 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Product Details — ${product.name}`}
      maxWidth="680px"
      footer={
        <button onClick={onClose} className="btn btn-secondary">
          Close
        </button>
      }
    >
      <div>
        {/* Basic Metadata Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '16px',
            backgroundColor: 'var(--surface-input)',
            padding: '16px',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            marginBottom: '20px',
          }}
        >
          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU / CODE</span>
            <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '1rem' }}>
              {product.sku}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>UNIT OF MEASURE</span>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {product.unit_of_measure}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>INITIAL STOCK</span>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {parseFloat(product.initial_stock || '0').toFixed(2)}
            </div>
          </div>

          <div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>TOTAL STOCK</span>
            <div style={{ fontWeight: 700, color: 'var(--color-success)', fontSize: '1.125rem' }}>
              {totalQuantity.toFixed(2)} {product.unit_of_measure}
            </div>
          </div>
        </div>

        {/* Location-wise Stock Section */}
        <div style={{ marginBottom: '8px' }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={16} style={{ color: 'var(--color-primary)' }} />
            Location-Wise Stock Availability
          </h4>

          {loading ? (
            <LoadingState message="Fetching location balances..." height="150px" />
          ) : stockRows.length === 0 ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                backgroundColor: 'var(--surface-card)',
                borderRadius: '8px',
                border: '1px dashed var(--border-color)',
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
              }}
            >
              <Package size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
              <div>No stock balance records found for this product across locations.</div>
            </div>
          ) : (
            <div style={{ borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--surface-table-header)', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Warehouse
                    </th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Location
                    </th>
                    <th style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', textAlign: 'right' }}>
                      Quantity Available
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stockRows.map((row, i) => {
                    const wh = warehouses.find((w) => w.id === row.warehouse_id);
                    const loc = locations.find((l) => l.id === row.location_id);
                    return (
                      <tr
                        key={i}
                        style={{ borderBottom: i === stockRows.length - 1 ? 'none' : '1px solid var(--border-color-subtle)' }}
                      >
                        <td style={{ padding: '12px 14px', color: 'var(--text-primary)', fontWeight: 500 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <WarehouseIcon size={14} style={{ color: 'var(--text-muted)' }} />
                            {wh ? `${wh.name} (${wh.short_code})` : row.warehouse_id}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                            {loc ? `${loc.name} (${loc.short_code})` : row.location_id}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)' }}>
                          {parseFloat(row.quantity || '0').toFixed(2)} {product.unit_of_measure}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && <ProductMovements product={product} currentStock={totalQuantity} />}
      </div>
    </Modal>
  );
};
