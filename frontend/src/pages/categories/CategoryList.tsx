import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit3, Trash2, FolderTree, AlertCircle } from '../../components/ui/icons';
import { api } from '../../services/api';
import type { Category } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ErrorState } from '../../components/ui/ErrorState';

export const CategoryList: React.FC = () => {
  const { isManager } = useAuth();
  const { showToast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  // Delete dialog states
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load product categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      setModalError('Category name is required.');
      return;
    }

    setSubmitting(true);
    setModalError('');

    try {
      if (editingCategory) {
        await api.updateCategory(editingCategory.id, { name: nameInput.trim() });
        showToast('success', 'Category Updated', `Category updated to "${nameInput.trim()}".`);
      } else {
        await api.createCategory({ name: nameInput.trim() });
        showToast('success', 'Category Created', `Category "${nameInput.trim()}" created successfully.`);
      }
      setIsModalOpen(false);
      loadCategories();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setModalError(e.message || 'Failed to save category.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;
    setDeleting(true);
    try {
      await api.deleteCategory(deletingCategory.id);
      showToast('success', 'Category Deleted', `Category "${deletingCategory.name}" was removed.`);
      setIsDeleteOpen(false);
      loadCategories();
    } catch (err: unknown) {
      const e = err as { message?: string };
      showToast('error', 'Cannot Delete Category', e.message || 'Referenced categories cannot be deleted.');
      setIsDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<Category>[] = [
    {
      key: 'name',
      header: 'Category Name',
      render: (c) => (
        <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <FolderTree size={16} style={{ color: 'var(--color-primary)' }} />
          {c.name}
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Category UUID',
      render: (c) => (
        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
          {c.id}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (c) =>
        isManager ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              onClick={() => {
                setEditingCategory(c);
                setNameInput(c.name);
                setModalError('');
                setIsModalOpen(true);
              }}
              className="btn btn-secondary btn-sm"
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            >
              <Edit3 size={14} /> Edit
            </button>
            <button
              onClick={() => {
                setDeletingCategory(c);
                setIsDeleteOpen(true);
              }}
              className="btn btn-danger btn-sm"
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Product Categories</h2>
          <p className="page-subtitle">Organize products into logical category classifications</p>
        </div>
        {isManager && (
          <button
            onClick={() => {
              setEditingCategory(null);
              setNameInput('');
              setModalError('');
              setIsModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} /> Add Category
          </button>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={loadCategories} />
      ) : (
        <DataTable
          columns={columns}
          data={categories}
          keyExtractor={(c) => c.id}
          loading={loading}
          emptyTitle="No categories found"
          emptyDescription="Create your first product category to classify stock items."
          emptyActionLabel={isManager ? 'Add Category' : undefined}
          onEmptyAction={
            isManager
              ? () => {
                  setEditingCategory(null);
                  setNameInput('');
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
        title={editingCategory ? 'Edit Category' : 'Create Category'}
        maxWidth="440px"
        footer={
          <>
            <button onClick={() => setIsModalOpen(false)} className="btn btn-secondary" disabled={submitting}>
              Cancel
            </button>
            <button onClick={handleSave} className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Saving...' : editingCategory ? 'Update' : 'Create'}
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
            <label className="form-label">Category Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Raw Materials, Finished Goods, Electronics"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Category"
        message={`Are you sure you want to delete category "${deletingCategory?.name}"? Note that referenced categories cannot be deleted.`}
        confirmLabel="Delete Category"
        isDanger
        loading={deleting}
      />
    </div>
  );
};
