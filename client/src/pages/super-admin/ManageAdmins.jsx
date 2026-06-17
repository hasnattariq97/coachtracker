import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, ShieldAlert } from 'lucide-react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Badge from '../../components/ui/Badge';
import { TableRowSkeleton } from '../../components/ui/Skeleton';
import EmptyState from '../../components/ui/EmptyState';
import { useAuth } from '../../context/AuthContext';

const EMPTY_FORM = { name: '', email: '', password: '', region_id: '' };

const FormField = ({ label, id, error, ...inputProps }) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
      {label}
    </label>
    <input
      id={id}
      className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition ${
        error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
      }`}
      {...inputProps}
    />
    {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
  </div>
);

const ManageAdmins = () => {
  const { user } = useAuth();
  const [admins, setAdmins] = useState([]);
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const deleteTimersRef = useRef({});

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      axios.get('/api/admins'),
      axios.get('/api/admins/regions/overview'),
    ])
      .then(([adminsRes, regionsRes]) => {
        setAdmins(adminsRes.data);
        setRegions(regionsRes.data);
      })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const timers = deleteTimersRef.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, []);

  const validateAdd = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    if (!form.password.trim()) errors.password = 'Password is required';
    if (!form.region_id) errors.region_id = 'Region is required';
    return errors;
  };

  const validateEdit = () => {
    const errors = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    return errors;
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setShowAdd(true);
  };

  const openEdit = (admin) => {
    setEditTarget(admin);
    setForm({ name: admin.name, email: admin.email, password: '', region_id: '' });
    setFormErrors({});
    setShowEdit(true);
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const errors = validateAdd();
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setSubmitting(true);
    try {
      await axios.post('/api/admins', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        region_id: Number(form.region_id),
      });
      toast.success('Admin created');
      setShowAdd(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create admin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const errors = validateEdit();
    if (Object.keys(errors).length) { setFormErrors(errors); return; }
    setSubmitting(true);
    const body = { name: form.name.trim(), email: form.email.trim() };
    if (form.password.trim()) body.password = form.password;
    try {
      await axios.put(`/api/admins/${editTarget.id}`, body);
      toast.success('Admin updated');
      setShowEdit(false);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update admin');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (admin) => {
    if (admin.email === user?.email) {
      toast.error('Cannot delete your own account');
      return;
    }
    if (pendingDelete === admin.id) {
      clearTimeout(deleteTimersRef.current[admin.id]);
      delete deleteTimersRef.current[admin.id];
      confirmDelete(admin.id);
      return;
    }
    setPendingDelete(admin.id);
    const timer = setTimeout(() => {
      setPendingDelete((prev) => (prev === admin.id ? null : prev));
      delete deleteTimersRef.current[admin.id];
    }, 3000);
    deleteTimersRef.current[admin.id] = timer;
  };

  const cancelDelete = (adminId) => {
    clearTimeout(deleteTimersRef.current[adminId]);
    delete deleteTimersRef.current[adminId];
    setPendingDelete(null);
  };

  const confirmDelete = async (adminId) => {
    setPendingDelete(null);
    try {
      await axios.delete(`/api/admins/${adminId}`);
      toast.success('Admin deleted');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete admin');
    }
  };

  const updateField = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    if (formErrors[field]) setFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-gray-900">Manage Admins</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage regional administrators</p>
        </div>
        <Button variant="primary" size="md" icon={Plus} onClick={openAdd}>
          Add Admin
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Region</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <>
                <TableRowSkeleton cols={4} />
                <TableRowSkeleton cols={4} />
                <TableRowSkeleton cols={4} />
              </>
            ) : admins.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <EmptyState
                    icon={ShieldAlert}
                    title="No admins yet"
                    message="Add your first regional admin to get started."
                  />
                </td>
              </tr>
            ) : (
              admins.map((admin) => (
                <tr key={admin.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{admin.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{admin.email}</td>
                  <td className="px-4 py-3">
                    {admin.region_name ? (
                      <Badge value="admin">{admin.region_name}</Badge>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={Pencil}
                        onClick={() => openEdit(admin)}
                      >
                        Edit
                      </Button>
                      {pendingDelete === admin.id ? (
                        <>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                              clearTimeout(deleteTimersRef.current[admin.id]);
                              delete deleteTimersRef.current[admin.id];
                              confirmDelete(admin.id);
                            }}
                          >
                            Confirm?
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelDelete(admin.id)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          className="text-red-500 hover:bg-red-50 hover:text-red-700"
                          onClick={() => handleDeleteClick(admin)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Add Admin Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Admin" size="md">
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <FormField
            label="Name"
            id="add-name"
            type="text"
            placeholder="Full name"
            value={form.name}
            onChange={updateField('name')}
            error={formErrors.name}
          />
          <FormField
            label="Email"
            id="add-email"
            type="email"
            placeholder="admin@example.com"
            value={form.email}
            onChange={updateField('email')}
            error={formErrors.email}
          />
          <FormField
            label="Password"
            id="add-password"
            type="password"
            placeholder="Temporary password"
            value={form.password}
            onChange={updateField('password')}
            error={formErrors.password}
          />
          <div>
            <label htmlFor="add-region" className="block text-sm font-medium text-gray-700 mb-1">
              Region
            </label>
            <select
              id="add-region"
              value={form.region_id}
              onChange={updateField('region_id')}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 transition ${
                formErrors.region_id ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white'
              }`}
            >
              <option value="">Select a region…</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            {formErrors.region_id && (
              <p className="mt-1 text-xs text-red-500">{formErrors.region_id}</p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="md" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={submitting}>
              Create Admin
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Admin Modal */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Admin" size="md">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <FormField
            label="Name"
            id="edit-name"
            type="text"
            placeholder="Full name"
            value={form.name}
            onChange={updateField('name')}
            error={formErrors.name}
          />
          <FormField
            label="Email"
            id="edit-email"
            type="email"
            placeholder="admin@example.com"
            value={form.email}
            onChange={updateField('email')}
            error={formErrors.email}
          />
          <FormField
            label="New Password"
            id="edit-password"
            type="password"
            placeholder="Leave blank to keep unchanged"
            value={form.password}
            onChange={updateField('password')}
            error={formErrors.password}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="md" onClick={() => setShowEdit(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="md" loading={submitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ManageAdmins;
