import React, { useState } from 'react';
import { History, Search, Shield, User, Clock, FileText } from 'lucide-react';
import { AuditLog } from '../../types';

interface AuditLogsViewProps {
  logs: AuditLog[];
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ logs }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = logs.filter((log) => {
    const uName = log.userName || log.user || '';
    const desc = log.details || log.record || log.newValue || '';
    return (
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      desc.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="clay-card p-6 space-y-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl clay-sphere-orange flex items-center justify-center text-white shadow-xs">
              <History className="w-5 h-5 drop-shadow-xs" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-800 uppercase tracking-tight">
                Audit Trail & Activity Log
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Rekam jejak seluruh aktivitas sistem, perubahan data sesi live, jadwal, dan streamer oleh Admin maupun Host.
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari aksi, user, atau rincian log..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:bg-white focus:ring-2 focus:ring-blue-500 shadow-xs"
            />
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Total Aktivitas: <strong className="text-slate-800">{logs.length}</strong> Event
          </span>
        </div>
      </div>

      {/* LOGS LIST */}
      <div className="clay-card p-6 space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Belum ada catatan aktivitas.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-slate-300 shadow-xs transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-800 text-xs">{log.action}</span>
                    <span className="px-2.5 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 rounded-lg">
                      {log.userName || log.user || 'Sistem'}
                    </span>
                  </div>
                  {(log.details || log.record) && (
                    <p className="text-slate-600 text-[11px] leading-relaxed font-medium">
                      {log.details || `${log.record} (${log.newValue})`}
                    </p>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 font-semibold shrink-0 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    {log.createdAt?.toDate
                      ? log.createdAt.toDate().toLocaleString('id-ID')
                      : log.timestamp?.toDate
                      ? log.timestamp.toDate().toLocaleString('id-ID')
                      : 'Baru saja'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
