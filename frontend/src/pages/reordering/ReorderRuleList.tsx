import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, AlertCircle } from '../../components/ui/icons';
import { api } from '../../services/api';
import type { ReorderRule, Product } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ErrorState } from '../../components/ui/ErrorState';

export const ReorderRuleList: React.FC = () => {
  const { isManager } = useAuth();
  const { showToast } = useToast();

  const [rules, setRules] = useState<ReorderRule[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ReorderRule | null>(null);
  const [productId, setProductId] = useState('');
  const [minimumStock, setMinimumStock] = useState('10');
  const [reorderQuantity, setReorderQuantity] = useState('50');

  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, prodsRes] = await Promise.all([
        api.getReorderRules(),
        api.getProducts(),
      ]);
      setRules(rulesRes);
      setProducts(prodsRes);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load reordering rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      setModalError('Product selection is required.');
      return;
    }
    const minVal = parseFloat(minimumStock);
    const reorderVal = parseFloat(reorderQuantity);

    if (isNaN(minVal) || minVal < 0) {
      setModalError('Minimum stock must be 0 or greater.');
      return;
    }
    if (isNaN(reorderVal) || reorderVal <= 0) {
      setModalError('Reorder quantity must be greater than 0.');
      return;
    }

    setSubmitting(true);
    setModalError('');

    try {
      const payload = {
        product_id: productId,
        minimum_stock: minimumStock,
        reorder_quantity: reorderQuantity,
      };

      if (editingRule) {
        await api.updateReorderRule(editingRule.id, payload);
        showToast('success', 'Rule Updated', 'Reorder rule updated successfully.');
      } else {
        await api.createReorderRule(payload);
        showToast('success', 'Rule Configured', 'New product reorder rule configured.');
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setModalError(e.message || 'Failed to save reorder rule.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<ReorderRule>[] = [
    {
      key: 'product_id',
      header: 'Product Name / SKU',
      render: (r) => {
        const prod = products.find((p) => p.id === r.product_id);
        return (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {prod ? prod.name : r.product_id}
            </div>
            {prod && (
              <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                {prod.sku} ({prod.unit_of_measure})
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'minimum_stock',
      header: 'Minimum Stock Level',
      align: 'right',
      render: (r) => (
        <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>
          {parseFloat(r.minimum_stock).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'reorder_quantity',
      header: 'Reorder Batch Quantity',
      align: 'right',
      render: (r) => (
        <span style={{ fontWeight: 700, color: 'var(--color-success)' }}>
          {parseFloat(r.reorder_quantity).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) =>
        isManager ? (
          <button
            onClick={() => {
              setEditingRule(r);
              setProductId(r.product_id);
              setMinimumStock(r.minimum_stock);
              setReorderQuantity(r.reorder_quantity);
              setModalError('');
              setIsModalOpen(true);
            }}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
          >
            <Edit3 size={14} /> Edit
          </button>
        ) : null,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Reordering Rules</h2>
          <p className="page-subtitle">Set automated low stock triggers and suggested reorder batch sizes</p>
        </div>
        {isManager && (
          <button
            onClick={() => {
              setEditingRule(null);
              setProductId(products.length > 0 ? products[0].id : '');
              setMinimumStock('10');
              setReorderQuantity('50');
              setModalError('');
              setIsModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} /> Configure Rule
          </button>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <DataTable
          columns={columns}
          data={rules}
          keyExtractor={(r) => r.id}
          loading={loading}
          emptyTitle="No reorder rules configured"
          emptyDescription="Configure minimum stock levels and reorder batch quantities for products."
          emptyActionLabel={isManager ? 'Configure Rule' : undefined}
          onEmptyAction={
            isManager
              ? () => {
                  setEditingRule(null);
                  setProductId(products.length > 0 ? products[0].id : '');
                  setMinimumStock('10');
                  setReorderQuantity('50');
                  setModalError('');
                  setIsModalOpen(true);
                }
              : undefined
          }
        />
      )}

      {/* Modal Form */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRule ? 'Edit Reorder Rule' : 'Configure Reorder Rule'}
        maxWidth="480px"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button onClick={handleSave} className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : editingRule ? 'Update Rule' : 'Save Rule'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          {modalError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-danger-subtle)',
                border: '1px solid var(--border-danger)',
                color: 'var(--color-danger)',
                fontSize: '0.8438rem',
                marginBottom: '16px',
              }}
            >
              <AlertCircle size={16} />
              <span>{modalError}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Select Product *</label>
            <select
              className="form-input"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              disabled={submitting || Boolean(editingRule)}
            >
              <option value="" disabled>Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Minimum Stock Threshold *</label>
            <input
              type="number"
              step="0.0001"
              min="0"
              className="form-input"
              value={minimumStock}
              onChange={(e) => setMinimumStock(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Reorder Batch Quantity *</label>
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              className="form-input"
              value={reorderQuantity}
              onChange={(e) => setReorderQuantity(e.target.value)}
              disabled={submitting}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
