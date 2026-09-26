import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, MapPin, Warehouse as WarehouseIcon, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import type { Location, Warehouse } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { Modal } from '../../components/ui/Modal';
import { ErrorState } from '../../components/ui/ErrorState';

export const LocationList: React.FC = () => {
  const { isManager } = useAuth();
  const { showToast } = useToast();

  const [locations, setLocations] = useState<Location[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [name, setName] = useState('');
  const [shortCode, setShortCode] = useState('');
  const [warehouseId, setWarehouseId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [locRes, whRes] = await Promise.all([
        api.getLocations(selectedWarehouseFilter || undefined),
        api.getWarehouses(),
      ]);
      setLocations(locRes);
      setWarehouses(whRes);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load storage locations');
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setModalError('Location name is required.');
      return;
    }
    if (!shortCode.trim()) {
      setModalError('Short code is required.');
      return;
    }
    if (!warehouseId) {
      setModalError('Parent warehouse selection is required.');
      return;
    }

    setSubmitting(true);
    setModalError('');

    try {
      const payload = {
        name: name.trim(),
        short_code: shortCode.trim().toUpperCase(),
        warehouse_id: warehouseId,
      };

      if (editingLocation) {
        await api.updateLocation(editingLocation.id, payload);
        showToast('success', 'Location Updated', `Location ${name} updated successfully.`);
      } else {
        await api.createLocation(payload);
        showToast('success', 'Location Created', `Location ${name} created successfully.`);
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setModalError(e.message || 'Failed to save location.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<Location>[] = [
    {
      key: 'short_code',
      header: 'Location Code',
      render: (l) => (
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
          {l.short_code}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Location Name / Bin',
      render: (l) => (
        <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={16} style={{ color: 'var(--color-primary)' }} />
          {l.name}
        </span>
      ),
    },
    {
      key: 'warehouse_id',
      header: 'Parent Warehouse',
      render: (l) => {
        const wh = warehouses.find((w) => w.id === l.warehouse_id);
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <WarehouseIcon size={14} style={{ color: 'var(--text-muted)' }} />
            {wh ? `${wh.name} (${wh.short_code})` : l.warehouse_id}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (l) =>
        isManager ? (
          <button
            onClick={() => {
              setEditingLocation(l);
              setName(l.name);
              setShortCode(l.short_code);
              setWarehouseId(l.warehouse_id);
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
          <h2 className="page-title">Locations Management</h2>
          <p className="page-subtitle">Configure specific storage racks, shelves, and production floors</p>
        </div>
        {isManager && (
          <button
            onClick={() => {
              setEditingLocation(null);
              setName('');
              setShortCode('');
              setWarehouseId(warehouses.length > 0 ? warehouses[0].id : '');
              setModalError('');
              setIsModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={18} /> Add Location
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <FilterDropdown
          label="Filter by Warehouse"
          value={selectedWarehouseFilter}
          onChange={setSelectedWarehouseFilter}
          allLabel="All Warehouses"
          options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.short_code})` }))}
        />
      </div>

      {error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <DataTable
          columns={columns}
          data={locations}
          keyExtractor={(l) => l.id}
          loading={loading}
          emptyTitle="No storage locations found"
          emptyDescription="Create a storage rack or location associated with a warehouse."
          emptyActionLabel={isManager ? 'Add Location' : undefined}
          onEmptyAction={
            isManager
              ? () => {
                  setEditingLocation(null);
                  setName('');
                  setShortCode('');
                  setWarehouseId(warehouses.length > 0 ? warehouses[0].id : '');
                  setModalError('');
                  setIsModalOpen(true);
                }
              : undefined
          }
        />
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingLocation ? 'Edit Storage Location' : 'Create Storage Location'}
        maxWidth="480px"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button onClick={handleSave} className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : editingLocation ? 'Update' : 'Create'}
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
            <label className="form-label">Parent Warehouse *</label>
            <select
              className="form-input"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              disabled={submitting || Boolean(editingLocation)}
            >
              <option value="" disabled>Select warehouse</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.short_code})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Location Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Rack A - Shelf 2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Location Short Code *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. RACK-A2"
              value={shortCode}
              onChange={(e) => setShortCode(e.target.value.toUpperCase())}
              disabled={submitting}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
