import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Warehouse as WarehouseIcon, MapPin, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import type { Warehouse, Location } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ErrorState } from '../../components/ui/ErrorState';

export const WarehouseList: React.FC = () => {
  const { isManager } = useAuth();
  const { showToast } = useToast();

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [whRes, locRes] = await Promise.all([
        api.getWarehouses(),
        api.getLocations(),
      ]);
      setWarehouses(whRes);
      setLocations(locRes);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load warehouses');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setModalError('Warehouse name is required.');
      return;
    }
    if (!shortCode.trim()) {
      setModalError('Short code is required.');
      return;
    }

    setSubmitting(true);
    setModalError('');

    try {
      const payload = {
        name: name.trim(),
        short_code: shortCode.trim().toUpperCase(),
        address: address.trim(),
      };

      if (editingWarehouse) {
        await api.updateWarehouse(editingWarehouse.id, payload);
        showToast('success', 'Warehouse Updated', `Warehouse ${name} updated successfully.`);
      } else {
        await api.createWarehouse(payload);
        showToast('success', 'Warehouse Created', `Warehouse ${name} created successfully.`);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setModalError(e.message || 'Failed to save warehouse.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<Warehouse>[] = [
    {
      key: 'short_code',
      header: 'Code',
      render: (w) => (
        <span
          style={{
            fontWeight: 700,
            color: 'var(--color-primary)',
            backgroundColor: 'var(--color-primary-light)',
            padding: '2px 8px',
            borderRadius: '6px',
            fontFamily: 'monospace',
          }}
        >
          {w.short_code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Warehouse Name',
      render: (w) => (
        <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <WarehouseIcon size={16} style={{ color: 'var(--text-muted)' }} />
          {w.name}
        </span>
      ),
    },
    {
      key: 'address',
      header: 'Address / Location',
      render: (w) => (
        <span style={{ color: 'var(--text-muted)' }}>{w.address || '—'}</span>
      ),
    },
    {
      key: 'locationsCount',
      header: 'Storage Racks / Locations',
      render: (w) => {
        const count = locations.filter((l) => l.warehouse_id === w.id).length;
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <MapPin size={14} style={{ color: 'var(--color-primary)' }} />
            {count} location(s)
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (w) =>
        isManager ? (
          <button
            onClick={() => {
              setEditingWarehouse(w);
              setName(w.name);
              setShortCode(w.short_code);
              setAddress(w.address || '');
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
          <h2 className="page-title">Warehouses Management</h2>
          <p className="page-subtitle">Configure primary facilities and distribution hubs</p>
        </div>
        {isManager && (
          <button
            onClick={() => {
              setEditingWarehouse(null);
              setName('');
              setShortCode('');
              setAddress('');
              setModalError('');
              setIsModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={18} /> Add Warehouse
          </button>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <DataTable
          columns={columns}
          data={warehouses}
          keyExtractor={(w) => w.id}
          loading={loading}
          emptyTitle="No warehouses configured"
          emptyDescription="Add a warehouse facility to start organizing storage locations."
          emptyActionLabel={isManager ? 'Add Warehouse' : undefined}
          onEmptyAction={
            isManager
              ? () => {
                  setEditingWarehouse(null);
                  setName('');
                  setShortCode('');
                  setAddress('');
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
        title={editingWarehouse ? 'Edit Warehouse' : 'Create Warehouse'}
        maxWidth="480px"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button onClick={handleSave} className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : editingWarehouse ? 'Update' : 'Create'}
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
            <label className="form-label">Warehouse Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Main Distribution Center"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Short Code * (Unique)</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. WH-MAIN or WH01"
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value.toUpperCase())}
              disabled={submitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Address / Facility Notes</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Facility address details..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={submitting}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
