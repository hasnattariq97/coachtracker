import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import Modal from './ui/Modal';
import Button from './ui/Button';

const DelayReasonModal = ({ open, taskId, taskTitle, onClose, onSaved }) => {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await axios.put(`/api/tasks/${taskId}/delay-reason`, { delay_reason: reason.trim() });
      toast.success("Thank you for sharing. Together, we'll get back on track! 💪");
      setReason('');
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit reason');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Share What Got in the Way" size="md">
      <div className="mb-5">
        <p className="text-sm text-slate-500 leading-relaxed">
          It's okay to hit a wall — what matters is moving forward. For <strong className="text-primary-800">"{taskTitle}"</strong>,
          please share what blocked you so we can support you better.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="reason" className="block text-sm font-medium text-primary-800 mb-1.5">
            What got in the way?
          </label>
          <textarea
            id="reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Waiting on approval from the legal team, unexpected client escalation…"
            rows={4}
            required
            maxLength={500}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-50
                       focus:bg-white focus:border-primary-400 focus:ring-2 focus:ring-primary-100
                       outline-none transition-all resize-none"
          />
          <p className="text-xs text-slate-400 mt-1 text-right">{reason.length}/500</p>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading} className="flex-1" variant="accent">
            Share & Move Forward
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default DelayReasonModal;
