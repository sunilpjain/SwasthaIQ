import React, { useState, useEffect } from 'react'

// ── Clinic identity (injected per tenant in production) ────────────────────────
const CLINIC = {
  name: 'Harmony Healthcare',
  tagline: 'Orthopedics & Physiotherapy',
  logoUrl: '/src/imports/harmony_clinic_logo.jpeg',
  logoPlaceholder: 'HH',
  logoColor: '#1D4ED8',
  logoBg: '#EFF6FF',
}

// ── Types ──────────────────────────────────────────────────────────────────────
type Status = 'waiting' | 'checked-in' | 'nurse-exam' | 'with-doctor' | 'completed' | 'cancelled'
type DoctorStatus = 'not-arrived' | 'arrived' | 'in-session'
type Priority = 'routine' | 'urgent' | 'emergency'

interface Patient {
  id: string; token: string; name: string; age: number; gender: 'M' | 'F'
  phone: string; doctor: string; reason: string; arrivalTime: string
  status: Status; priority: Priority; isNew: boolean
}

interface Appointment {
  id: string; time: string; name: string; doctor: string; type: string
  status: 'confirmed' | 'arrived' | 'in-progress' | 'done' | 'no-show'
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const INITIAL_PATIENTS: Patient[] = [
  { id: 'P-2841', token: 'A01', name: 'Suresh Deshpande',    age: 54, gender: 'M', phone: '98220 11234', doctor: 'Dr. Uday Pote',     reason: 'Post-op knee follow-up',        arrivalTime: '08:40', status: 'with-doctor', priority: 'routine', isNew: false },
  { id: 'P-3192', token: 'A02', name: 'Priya Kulkarni',      age: 38, gender: 'F', phone: '97300 54321', doctor: 'Dr. Himanshu Jain', reason: 'Shoulder physiotherapy session', arrivalTime: '09:00', status: 'nurse-exam',  priority: 'routine', isNew: false },
  { id: 'P-3501', token: 'A03', name: 'Rajesh Sharma',       age: 45, gender: 'M', phone: '91200 98765', doctor: 'Dr. Uday Pote',     reason: 'Lower back pain, radiating',    arrivalTime: '09:15', status: 'waiting',     priority: 'urgent',  isNew: true  },
  { id: 'P-2017', token: 'A04', name: 'Meena Agarwal',       age: 62, gender: 'F', phone: '99870 11223', doctor: 'Dr. Himanshu Jain', reason: 'Knee rehab — post surgery',     arrivalTime: '09:22', status: 'checked-in',  priority: 'routine', isNew: false },
  { id: 'P-4008', token: 'A05', name: 'Vikram Patil',        age: 33, gender: 'M', phone: '88920 44556', doctor: 'Dr. Uday Pote',     reason: 'Sports injury — ACL sprain',    arrivalTime: '09:38', status: 'checked-in',  priority: 'routine', isNew: true  },
  { id: 'P-NEW1', token: 'A06', name: 'Sunita Gupta',        age: 47, gender: 'F', phone: '90000 77889', doctor: 'Dr. Himanshu Jain', reason: 'Cervical spondylosis therapy',  arrivalTime: '09:50', status: 'nurse-exam',  priority: 'routine', isNew: false },
  { id: 'P-1834', token: 'A07', name: 'Ramesh Mahajan',      age: 68, gender: 'M', phone: '94400 33210', doctor: 'Dr. Uday Pote',     reason: 'Hip replacement consult',       arrivalTime: '09:55', status: 'waiting',     priority: 'routine', isNew: false },
  { id: 'P-2290', token: 'A08', name: 'Anita Joshi',         age: 29, gender: 'F', phone: '98760 65432', doctor: 'Dr. Himanshu Jain', reason: 'Post-fracture physio',          arrivalTime: '10:08', status: 'checked-in',  priority: 'routine', isNew: false },
  { id: 'P-0993', token: 'A09', name: 'Dinesh Verma',        age: 51, gender: 'M', phone: '97001 22334', doctor: 'Dr. Uday Pote',     reason: 'Spine MRI review',              arrivalTime: '10:20', status: 'completed',   priority: 'routine', isNew: false },
  { id: 'P-0871', token: 'A10', name: 'Kavita Shinde',       age: 41, gender: 'F', phone: '90112 55667', doctor: 'Dr. Himanshu Jain', reason: 'Frozen shoulder — follow-up',   arrivalTime: '08:30', status: 'completed',   priority: 'routine', isNew: false },
]

interface Doctor {
  name: string
  specialty: string
  status: DoctorStatus
  arrivedAt?: string
}

const INITIAL_DOCTORS: Doctor[] = [
  { name: 'Dr. Uday Pote',     specialty: 'Orthopedic Surgeon & Spine Specialist', status: 'in-session', arrivedAt: '08:35' },
  { name: 'Dr. Himanshu Jain', specialty: 'Physiotherapist',                       status: 'arrived',    arrivedAt: '09:05' },
]

const APPOINTMENTS: Appointment[] = [
  { id: '1', time: '08:30', name: 'Kavita Shinde',    doctor: 'Dr. Himanshu Jain', type: 'Physio Session', status: 'done'        },
  { id: '2', time: '09:00', name: 'Suresh Deshpande', doctor: 'Dr. Uday Pote',     type: 'Follow-up',      status: 'in-progress' },
  { id: '3', time: '09:30', name: 'Priya Kulkarni',   doctor: 'Dr. Himanshu Jain', type: 'Physio Session', status: 'arrived'     },
  { id: '4', time: '10:00', name: 'Rajesh Sharma',    doctor: 'Dr. Uday Pote',     type: 'New Consult',    status: 'arrived'     },
  { id: '5', time: '10:30', name: 'Meena Agarwal',    doctor: 'Dr. Himanshu Jain', type: 'Physio Session', status: 'confirmed'   },
  { id: '6', time: '11:00', name: 'Vikram Patil',     doctor: 'Dr. Uday Pote',     type: 'Review',         status: 'confirmed'   },
  { id: '7', time: '11:30', name: 'Pooja Bhosale',    doctor: 'Dr. Himanshu Jain', type: 'New Consult',    status: 'confirmed'   },
  { id: '8', time: '12:00', name: 'Arun Mishra',      doctor: 'Dr. Uday Pote',     type: 'Follow-up',      status: 'confirmed'   },
]

// ── Configs ────────────────────────────────────────────────────────────────────
const STATUS_CFG: Record<Status, { label: string; bg: string; text: string; dot: string; ring: string }> = {
  'waiting':     { label: 'Waiting',     bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B', ring: '#FDE68A' },
  'checked-in':  { label: 'Checked In',  bg: '#F5F3FF', text: '#5B21B6', dot: '#7C3AED', ring: '#DDD6FE' },
  'nurse-exam':  { label: 'Nurse Exam',  bg: '#FFF0FB', text: '#86198F', dot: '#D946EF', ring: '#F5D0FE' },
  'with-doctor': { label: 'With Doctor', bg: '#EFF6FF', text: '#1E40AF', dot: '#3B82F6', ring: '#BFDBFE' },
  'completed':   { label: 'Completed',   bg: '#ECFDF5', text: '#065F46', dot: '#10B981', ring: '#A7F3D0' },
  'cancelled':   { label: 'Cancelled',   bg: '#F9FAFB', text: '#6B7280', dot: '#9CA3AF', ring: '#E5E7EB' },
}

const DOCTOR_STATUS_CFG: Record<DoctorStatus, { label: string; dot: string; text: string; bg: string; action: string }> = {
  'not-arrived': { label: 'Not Arrived', dot: '#9CA3AF', text: '#6B7280', bg: '#F9FAFB', action: 'Mark Arrived' },
  'arrived':     { label: 'Arrived',     dot: '#F59E0B', text: '#92400E', bg: '#FFFBEB', action: 'Start Session' },
  'in-session':  { label: 'In Session',  dot: '#10B981', text: '#065F46', bg: '#ECFDF5', action: 'End Session'   },
}

const APPT_CFG: Record<Appointment['status'], { label: string; color: string }> = {
  'confirmed':   { label: 'Scheduled',   color: '#9CA3AF' },
  'arrived':     { label: 'Arrived',     color: '#D97706' },
  'in-progress': { label: 'In Progress', color: '#2563EB' },
  'done':        { label: 'Done',        color: '#10B981' },
  'no-show':     { label: 'No Show',     color: '#EF4444' },
}

// ── Small components ───────────────────────────────────────────────────────────
function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(' ').slice(0, 2).map(w => w[0]).join('')
  const hue = (name.charCodeAt(0) * 53 + name.charCodeAt(1) * 17) % 360
  return (
    <div className="flex-shrink-0 flex items-center justify-center rounded-full font-semibold text-white select-none"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${hue},52%,46%)`, fontFamily: 'var(--font-display)' }}>
      {initials}
    </div>
  )
}

function SearchIcon() {
  return <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M15 15l3 3"/></svg>
}
function BellIcon() {
  return <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 2a6 6 0 0 1 6 6c0 3.5 1.5 5 1.5 5h-15S4 11.5 4 8a6 6 0 0 1 6-6z"/><path d="M8.5 17a1.5 1.5 0 0 0 3 0"/></svg>
}
function CalPlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="16" height="14" rx="2"/><path d="M2 9h16M6 2v4M14 2v4M10 12v4M8 14h4"/></svg>
}
function UserPlusIcon() {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="8" cy="7" r="4"/><path d="M2 17c0-3 2.7-5 6-5s6 2 6 5"/><path d="M16 9v6M13 12h6"/></svg>
}
function ChevronRight() {
  return <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M7 5l6 5-6 5"/></svg>
}
function CloseIcon() {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 5l10 10M15 5L5 15"/></svg>
}

// ── Stat card — compact single-row variant ─────────────────────────────────────
function StatCard({ label, value, sub, accentColor, icon }: {
  label: string; value: number | string; sub: string; accentColor: string; icon: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl px-4 py-3 border border-gray-100 flex items-center gap-3 hover:shadow-sm transition-shadow">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: accentColor + '15', color: accentColor }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-800 leading-none" style={{ fontFamily: 'var(--font-display)', color: accentColor }}>
          {value}
        </p>
        <p className="text-xs font-600 text-gray-500 mt-0.5 truncate" style={{ fontFamily: 'var(--font-display)' }}>{label}</p>
        <p className="text-xs text-gray-400 truncate hidden xl:block">{sub}</p>
      </div>
    </div>
  )
}

// ── Icons for stat cards ───────────────────────────────────────────────────────
const TodayIcon  = () => <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M6 2v2h8V2h2v2h1a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1V2h2zm-3 6v9h14V8H3z"/></svg>
const WaitIcon   = () => <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 1 1 0 16A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12A6 6 0 0 0 10 4zm1 3v4.41l2.29 2.3-1.41 1.41L9 12.17V7h2z"/></svg>
const NurseIcon  = () => <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm1 9.93V13h2v2h-2v2H9v-2H7v-2h2v-1.07A7.001 7.001 0 0 1 17 19H3a7.001 7.001 0 0 1 8-7.07z"/></svg>
const DocIcon    = () => <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 10c4.42 0 8 1.79 8 4v1H2v-1c0-2.21 3.58-4 8-4z"/></svg>
const DoneIcon   = () => <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 1 1 0 16A8 8 0 0 1 10 2zm3.7 5.3-4.2 4.2-2.2-2.2-1.4 1.4 3.6 3.6 5.6-5.6-1.4-1.4z"/></svg>

// ── WhatsApp data & types ──────────────────────────────────────────────────────
type WaIntent = 'late' | 'reschedule' | 'cancel' | 'query'

interface WaMessage {
  id: string
  patientName: string
  patientPhone: string
  patientId: string
  message: string
  time: string
  read: boolean
  intent: WaIntent
  appointmentTime?: string
}

const INTENT_CFG: Record<WaIntent, { label: string; bg: string; text: string; dot: string }> = {
  late:        { label: 'Running Late',  bg: '#FFFBEB', text: '#92400E', dot: '#F59E0B' },
  reschedule:  { label: 'Reschedule',    bg: '#EFF6FF', text: '#1E40AF', dot: '#3B82F6' },
  cancel:      { label: 'Cancellation',  bg: '#FFF1F2', text: '#9F1239', dot: '#F43F5E' },
  query:       { label: 'Query',         bg: '#F5F3FF', text: '#5B21B6', dot: '#7C3AED' },
}

const WA_MESSAGES: WaMessage[] = [
  { id: 'w1', patientName: 'Priya Kulkarni',   patientPhone: '97300 54321', patientId: 'P-3192', message: "Hi, I'm stuck in traffic on the highway. Will be 20-25 min late for my 9:30 session. Please inform Dr. Himanshu 🙏", time: '09:08', read: false, intent: 'late',       appointmentTime: '09:30' },
  { id: 'w2', patientName: 'Vikram Patil',     patientPhone: '88920 44556', patientId: 'P-4008', message: "Can I reschedule today's 11:00 slot to tomorrow? My father is unwell and I need to be home.", time: '08:55', read: false, intent: 'reschedule', appointmentTime: '11:00' },
  { id: 'w3', patientName: 'Ramesh Mahajan',   patientPhone: '96000 11223', patientId: 'P-1834', message: "I got my X-ray done at the lab yesterday. Has Dr. Uday reviewed the report? Can I get a callback please?", time: '08:30', read: false, intent: 'query' },
  { id: 'w4', patientName: 'Arun Mishra',      patientPhone: '94400 88990', patientId: 'P-EXT2', message: "Good morning. I need to cancel my 12pm appointment today. Will call to reschedule. Sorry for the trouble.", time: '07:45', read: true,  intent: 'cancel',     appointmentTime: '12:00' },
  { id: 'w5', patientName: 'Anita Joshi',      patientPhone: '98760 65432', patientId: 'P-2290', message: "Reached the clinic. Couldn't find parking, took some time. Am I still in the queue?", time: '09:52', read: true,  intent: 'query' },
]

// ── WhatsApp icon ──────────────────────────────────────────────────────────────
function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}

// ── WhatsApp drawer ────────────────────────────────────────────────────────────
function WhatsAppDrawer({ messages, onClose, onMarkRead }: {
  messages: WaMessage[]
  onClose: () => void
  onMarkRead: (id: string) => void
}) {
  const unread = messages.filter(m => !m.read).length
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 bg-white shadow-2xl flex flex-col"
        style={{ width: 380, borderLeft: '1px solid #E5E7EB' }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#25D366', color: 'white' }}>
            <WhatsAppIcon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-700 text-gray-900 text-sm" style={{ fontFamily: 'var(--font-display)' }}>Patient Messages</p>
            <p className="text-xs text-gray-400">via WhatsApp · {unread} unread</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <CloseIcon />
          </button>
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          {messages.map(msg => {
            const ic = INTENT_CFG[msg.intent]
            return (
              <div
                key={msg.id}
                className="px-5 py-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50/70 transition-colors"
                style={{ background: msg.read ? 'white' : '#FAFFFE' }}
                onClick={() => onMarkRead(msg.id)}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={msg.patientName} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-600 text-gray-800 truncate" style={{ fontFamily: 'var(--font-display)' }}>
                          {msg.patientName}
                        </span>
                        {!msg.read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        )}
                      </div>
                      <span className="text-xs flex-shrink-0" style={{ fontFamily: 'var(--font-mono)', color: '#9CA3AF' }}>{msg.time}</span>
                    </div>

                    {/* Intent badge */}
                    <span
                      className="inline-flex items-center gap-1 text-xs font-600 px-2 py-0.5 rounded-full mb-2"
                      style={{ background: ic.bg, color: ic.text, fontFamily: 'var(--font-display)' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: ic.dot }} />
                      {ic.label}
                      {msg.appointmentTime && <span className="opacity-60 ml-0.5">· {msg.appointmentTime}</span>}
                    </span>

                    {/* Message bubble */}
                    <div
                      className="rounded-xl rounded-tl-none px-3 py-2 text-xs leading-relaxed text-gray-700"
                      style={{ background: '#F0FDF4', border: '1px solid #BBF7D0' }}
                    >
                      {msg.message}
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex gap-2 mt-2.5">
                      {msg.intent === 'late' && (
                        <button className="text-xs font-600 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                          Acknowledge
                        </button>
                      )}
                      {msg.intent === 'reschedule' && (
                        <button className="text-xs font-600 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                          Open Scheduler
                        </button>
                      )}
                      {msg.intent === 'cancel' && (
                        <button className="text-xs font-600 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                          Mark Cancelled
                        </button>
                      )}
                      {msg.intent === 'query' && (
                        <button className="text-xs font-600 px-3 py-1.5 rounded-lg bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                          Flag for Doctor
                        </button>
                      )}
                      <button className="text-xs font-600 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                        Reply ↗
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2">
          <div style={{ color: '#25D366' }}><WhatsAppIcon size={13} /></div>
          <p className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-body)' }}>
            Messages routed from clinic WhatsApp · Replies open in WhatsApp Web
          </p>
        </div>
      </div>
    </>
  )
}

// ── Register Patient Modal ─────────────────────────────────────────────────────
// ── Registration helpers ───────────────────────────────────────────────────────
function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-600 text-gray-500 flex items-center gap-1" style={{ fontFamily: 'var(--font-display)' }}>
        {label}
        {required && <span className="text-rose-400">*</span>}
        {hint && <span className="font-400 text-gray-400 normal-case">· {hint}</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT = "w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-teal-500 transition-colors bg-white text-gray-800 placeholder-gray-300"
const SELECT = "w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-teal-500 transition-colors bg-white text-gray-800"

// ── Register Page ──────────────────────────────────────────────────────────────
function RegisterPage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState<'A' | 'B' | 'done'>('A')

  // Part A state
  const [firstName, setFirstName]       = useState('')
  const [lastName, setLastName]         = useState('')
  const [dob, setDob]                   = useState('')
  const [age, setAge]                   = useState('')
  const [gender, setGender]             = useState('')
  const [mobile, setMobile]             = useState('')
  const [complaint, setComplaint]       = useState('')
  const [doctor, setDoctor]             = useState('')

  // Part B state
  const [address, setAddress]           = useState('')
  const [city, setCity]                 = useState('')
  const [pincode, setPincode]           = useState('')
  const [comorbidities, setComorbid]    = useState<string[]>([])
  const [otherComorbid, setOtherCo]     = useState('')
  const [medications, setMedications]   = useState('')
  const [surgeries, setSurgeries]       = useState('')
  const [ecName, setEcName]             = useState('')
  const [ecPhone, setEcPhone]           = useState('')
  const [ecRelation, setEcRelation]     = useState('')

  // Auto-calculate age from DOB
  const handleDob = (val: string) => {
    setDob(val)
    if (val) {
      const yrs = Math.floor((Date.now() - new Date(val).getTime()) / (365.25 * 24 * 3600 * 1000))
      setAge(String(yrs))
    }
  }

  const isUnderage = age !== '' && parseInt(age) < 18

  const COMORBID_OPTIONS = [
    'Diabetes', 'Hypertension', 'Asthma', 'Heart Disease',
    'Thyroid', 'Kidney Disease', 'Arthritis', 'Cancer',
  ]

  const toggleComorbid = (val: string) =>
    setComorbid(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val])

  const token = 'A' + String(Math.floor(Math.random() * 8 + 11))

  // ── Step indicator ─────────────────────────────────────────────────────────
  const StepBar = () => (
    <div className="flex items-center gap-0 mb-8">
      {(['A', 'B'] as const).map((s, i) => {
        const done = (s === 'A' && (step === 'B' || step === 'done')) || step === 'done'
        const active = step === s
        return (
          <div key={s} className="flex items-center flex-1">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 flex-shrink-0 transition-colors"
                style={{
                  fontFamily: 'var(--font-display)',
                  background: done ? '#0B7070' : active ? '#0B7070' : '#F3F4F6',
                  color: done || active ? 'white' : '#9CA3AF',
                }}>
                {done ? '✓' : s === 'A' ? '1' : '2'}
              </div>
              <div>
                <p className="text-xs font-700 leading-none" style={{ fontFamily: 'var(--font-display)', color: active || done ? '#0B7070' : '#9CA3AF' }}>
                  Part {s}
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF', fontFamily: 'var(--font-body)' }}>
                  {s === 'A' ? 'Essential Info' : 'Medical Profile'}
                </p>
              </div>
            </div>
            {i === 0 && (
              <div className="flex-1 mx-4 h-px" style={{ background: step !== 'A' ? '#0B7070' : '#E5E7EB' }} />
            )}
          </div>
        )
      })}
    </div>
  )

  // ── Done screen ────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#F4F7F9' }}>
        <PageHeader onBack={onClose} title="Register Patient" subtitle="New patient registration" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-10 max-w-md w-full text-center flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: '#E6F4F4' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0B7070" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div>
              <h2 className="text-xl font-700 text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
                {firstName} {lastName} registered!
              </h2>
              <p className="text-sm text-gray-400 mt-1" style={{ fontFamily: 'var(--font-body)' }}>
                Patient added to today's queue
              </p>
            </div>
            <div className="w-full rounded-2xl px-6 py-5 flex items-center justify-between" style={{ background: '#F4F7F9', border: '1px solid #E5E7EB' }}>
              <div className="text-left">
                <p className="text-xs text-gray-400 mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>Queue Token</p>
                <p className="text-3xl font-800" style={{ fontFamily: 'var(--font-mono)', color: '#0B7070' }}>{token}</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-400 mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>Assigned to</p>
                <p className="text-sm font-600 text-gray-800" style={{ fontFamily: 'var(--font-display)' }}>{doctor || 'Dr. Uday Pote'}</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-gray-400 mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>Status</p>
                <span className="text-xs font-600 px-2 py-1 rounded-full" style={{ background: '#FFFBEB', color: '#92400E', fontFamily: 'var(--font-display)' }}>Waiting</span>
              </div>
            </div>
            <div className="flex gap-3 w-full">
              <button onClick={onClose}
                className="flex-1 py-2.5 text-sm font-600 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                style={{ fontFamily: 'var(--font-display)' }}>
                Back to Dashboard
              </button>
              <button onClick={() => { setStep('A'); setFirstName(''); setLastName(''); setDob(''); setAge(''); setGender(''); setMobile(''); setComplaint(''); setDoctor('') }}
                className="flex-1 py-2.5 text-sm font-600 rounded-xl text-white transition-opacity hover:opacity-90"
                style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
                Register Another
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F4F7F9' }}>
      <PageHeader onBack={onClose} title="Register Patient" subtitle="New patient registration · Token auto-assigned on save" />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <StepBar />

          {/* ── Part A ──────────────────────────────────────────────── */}
          {step === 'A' && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-50">
                <h2 className="font-700 text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>Essential Information</h2>
                <p className="text-xs text-gray-400 mt-0.5">Minimum required to add patient to queue</p>
              </div>
              <div className="px-6 py-6 flex flex-col gap-5">

                {/* Name row */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="First Name" required>
                    <input value={firstName} onChange={e => setFirstName(e.target.value)}
                      placeholder="e.g. Anjali" className={INPUT} style={{ fontFamily: 'var(--font-body)' }} />
                  </Field>
                  <Field label="Last Name" required>
                    <input value={lastName} onChange={e => setLastName(e.target.value)}
                      placeholder="e.g. Mehta" className={INPUT} style={{ fontFamily: 'var(--font-body)' }} />
                  </Field>
                </div>

                {/* DOB + Age + Gender */}
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Date of Birth" hint="auto-fills age">
                    <input type="date" value={dob} onChange={e => handleDob(e.target.value)}
                      className={INPUT} style={{ fontFamily: 'var(--font-body)' }} />
                  </Field>
                  <Field label="Age" hint="or enter directly" required>
                    <input value={age} onChange={e => setAge(e.target.value)}
                      placeholder="years" type="number" min="0" max="120"
                      className={INPUT} style={{ fontFamily: 'var(--font-body)' }} />
                  </Field>
                  <Field label="Gender" required>
                    <select value={gender} onChange={e => setGender(e.target.value)} className={SELECT} style={{ fontFamily: 'var(--font-body)' }}>
                      <option value="">— Select —</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </Field>
                </div>

                {/* Age notice for underage */}
                {isUnderage && (
                  <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl" style={{ background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="#F97316" className="flex-shrink-0 mt-0.5"><path d="M10 2a8 8 0 1 1 0 16A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12A6 6 0 0 0 10 4zm0 9a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm0-7v5"/></svg>
                    <p className="text-xs text-orange-700" style={{ fontFamily: 'var(--font-body)' }}>
                      Patient is under 18 — emergency/guardian contact will be required in Part B.
                    </p>
                  </div>
                )}

                {/* Mobile */}
                <Field label="Mobile Number" required>
                  <input value={mobile} onChange={e => setMobile(e.target.value)}
                    placeholder="98XXXXXXXX" type="tel" maxLength={10}
                    className={INPUT} style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }} />
                </Field>

                {/* Chief complaint */}
                <Field label="Chief Complaint" required hint="reason for today's visit">
                  <textarea value={complaint} onChange={e => setComplaint(e.target.value)}
                    placeholder="e.g. Fever and body ache since 3 days, follow-up for diabetes…"
                    rows={3}
                    className={INPUT + ' resize-none'} style={{ fontFamily: 'var(--font-body)' }} />
                </Field>

                {/* Assign Doctor — optional */}
                <Field label="Assign Doctor" hint="optional — can assign later">
                  <select value={doctor} onChange={e => setDoctor(e.target.value)} className={SELECT} style={{ fontFamily: 'var(--font-body)' }}>
                    <option value="">— Assign later —</option>
                    {DOCTORS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </Field>
              </div>

              {/* Part A footer */}
              <div className="px-6 py-4 border-t border-gray-50 flex items-center justify-between gap-3">
                <button onClick={onClose}
                  className="px-4 py-2.5 text-sm font-600 text-gray-500 rounded-xl hover:bg-gray-100 transition-colors"
                  style={{ fontFamily: 'var(--font-display)' }}>
                  Cancel
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('done')}
                    className="px-5 py-2.5 text-sm font-600 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                    style={{ fontFamily: 'var(--font-display)' }}>
                    Save &amp; Add to Queue
                  </button>
                  <button
                    onClick={() => setStep('B')}
                    className="px-5 py-2.5 text-sm font-600 text-white rounded-xl transition-opacity hover:opacity-90 flex items-center gap-2"
                    style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
                    Continue to Medical Profile
                    <ChevronRight />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Part B ──────────────────────────────────────────────── */}
          {step === 'B' && (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-50">
                <h2 className="font-700 text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>Medical Profile</h2>
                <p className="text-xs text-gray-400 mt-0.5">Detailed background · helps doctors prepare before consultation</p>
              </div>
              <div className="px-6 py-6 flex flex-col gap-6">

                {/* Address */}
                <div>
                  <p className="text-xs font-700 uppercase tracking-widest text-gray-400 mb-3" style={{ fontFamily: 'var(--font-display)' }}>Address</p>
                  <div className="flex flex-col gap-4">
                    <Field label="Street / Locality">
                      <input value={address} onChange={e => setAddress(e.target.value)}
                        placeholder="e.g. 14, Gandhi Nagar, Koramangala"
                        className={INPUT} style={{ fontFamily: 'var(--font-body)' }} />
                    </Field>
                    <div className="grid grid-cols-2 gap-4">
                      <Field label="City">
                        <input value={city} onChange={e => setCity(e.target.value)}
                          placeholder="e.g. Bengaluru" className={INPUT} style={{ fontFamily: 'var(--font-body)' }} />
                      </Field>
                      <Field label="PIN Code">
                        <input value={pincode} onChange={e => setPincode(e.target.value)}
                          placeholder="560001" maxLength={6} type="text"
                          className={INPUT} style={{ fontFamily: 'var(--font-mono)' }} />
                      </Field>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gray-50" />

                {/* Co-morbidities */}
                <div>
                  <p className="text-xs font-700 uppercase tracking-widest text-gray-400 mb-3" style={{ fontFamily: 'var(--font-display)' }}>Known Co-morbidities</p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {COMORBID_OPTIONS.map(opt => {
                      const selected = comorbidities.includes(opt)
                      return (
                        <button key={opt} onClick={() => toggleComorbid(opt)}
                          className="px-3 py-1.5 rounded-xl text-xs font-600 border transition-colors"
                          style={{
                            fontFamily: 'var(--font-display)',
                            background: selected ? '#E6F4F4' : 'white',
                            color: selected ? '#0B7070' : '#6B7280',
                            borderColor: selected ? '#0B7070' : '#E5E7EB',
                          }}>
                          {selected && '✓ '}{opt}
                        </button>
                      )
                    })}
                  </div>
                  <input value={otherComorbid} onChange={e => setOtherCo(e.target.value)}
                    placeholder="Any others — e.g. Epilepsy, PCOD…"
                    className={INPUT} style={{ fontFamily: 'var(--font-body)' }} />
                </div>

                <div className="h-px bg-gray-50" />

                {/* Medications */}
                <Field label="Current Medications / Supplements" hint="name, dose if known">
                  <textarea value={medications} onChange={e => setMedications(e.target.value)}
                    placeholder="e.g. Metformin 500mg OD, Vitamin D3 60K weekly…"
                    rows={3} className={INPUT + ' resize-none'} style={{ fontFamily: 'var(--font-body)' }} />
                </Field>

                {/* Prior surgeries */}
                <Field label="Prior Surgeries / Hospitalisations" hint="with approximate year if known">
                  <textarea value={surgeries} onChange={e => setSurgeries(e.target.value)}
                    placeholder="e.g. Appendectomy 2018, Knee replacement 2022, None…"
                    rows={2} className={INPUT + ' resize-none'} style={{ fontFamily: 'var(--font-body)' }} />
                </Field>

                <div className="h-px bg-gray-50" />

                {/* Emergency / Guardian contact */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-700 uppercase tracking-widest text-gray-400" style={{ fontFamily: 'var(--font-display)' }}>
                      {isUnderage ? 'Parent / Guardian Contact' : 'Emergency Contact'}
                    </p>
                    {isUnderage && (
                      <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: '#FFF7ED', color: '#C2410C', fontFamily: 'var(--font-display)' }}>
                        Required (underage patient)
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <Field label="Full Name" required={isUnderage}>
                      <input value={ecName} onChange={e => setEcName(e.target.value)}
                        placeholder="Contact name" className={INPUT} style={{ fontFamily: 'var(--font-body)' }} />
                    </Field>
                    <Field label="Relationship">
                      <select value={ecRelation} onChange={e => setEcRelation(e.target.value)} className={SELECT} style={{ fontFamily: 'var(--font-body)' }}>
                        <option value="">— Select —</option>
                        <option>Spouse</option>
                        <option>Parent</option>
                        <option>Child</option>
                        <option>Sibling</option>
                        <option>Guardian</option>
                        <option>Other</option>
                      </select>
                    </Field>
                    <Field label="Mobile Number" required={isUnderage}>
                      <input value={ecPhone} onChange={e => setEcPhone(e.target.value)}
                        placeholder="98XXXXXXXX" type="tel" maxLength={10}
                        className={INPUT} style={{ fontFamily: 'var(--font-mono)' }} />
                    </Field>
                  </div>
                </div>
              </div>

              {/* Part B footer */}
              <div className="px-6 py-4 border-t border-gray-50 flex items-center justify-between gap-3">
                <button onClick={() => setStep('A')}
                  className="px-4 py-2.5 text-sm font-600 text-gray-500 rounded-xl hover:bg-gray-100 transition-colors flex items-center gap-1"
                  style={{ fontFamily: 'var(--font-display)' }}>
                  ← Back
                </button>
                <div className="flex gap-3">
                  <button onClick={() => setStep('done')}
                    className="px-5 py-2.5 text-sm font-600 text-gray-700 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                    style={{ fontFamily: 'var(--font-display)' }}>
                    Skip &amp; Add to Queue
                  </button>
                  <button onClick={() => setStep('done')}
                    className="px-5 py-2.5 text-sm font-600 text-white rounded-xl transition-opacity hover:opacity-90"
                    style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
                    Save &amp; Add to Queue
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Shared page header (back nav) ──────────────────────────────────────────────
function PageHeader({ onBack, title, subtitle }: { onBack: () => void; title: string; subtitle?: string }) {
  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 flex-shrink-0">
      <button onClick={onBack}
        className="p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500 flex-shrink-0"
        style={{ border: '1px solid #E5E7EB' }}>
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M13 5l-6 5 6 5"/></svg>
      </button>
      <div>
        <h1 className="font-700 text-gray-900 text-base leading-none" style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        <div className="w-4 h-4 rounded flex items-center justify-center text-white font-700"
          style={{ background: '#0B7070', fontSize: 8, fontFamily: 'var(--font-display)' }}>S</div>
        <p className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-body)' }}>
          Powered by <span className="font-500 text-gray-500">SwasthIQ</span>
        </p>
      </div>
    </header>
  )
}

// ── QR code SVG (deterministic pattern from patient id) ────────────────────────
function QRCodeSVG({ value, size = 160 }: { value: string; size?: number }) {
  const cells = 21
  const cell = size / cells
  // Seed a grid deterministically from value string
  const grid: boolean[][] = Array.from({ length: cells }, (_, r) =>
    Array.from({ length: cells }, (_, c) => {
      // Always draw finder patterns (top-left, top-right, bottom-left)
      const inFinder = (
        (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7)
      )
      if (inFinder) {
        const lr = r < 7 ? r : r - (cells - 7)
        const lc = c < 7 ? c : c >= cells - 7 ? c - (cells - 7) : c
        return (lr === 0 || lr === 6 || lc === 0 || lc === 6 || (lr >= 2 && lr <= 4 && lc >= 2 && lc <= 4))
      }
      // Data modules seeded from value
      let hash = 0
      const key = value + r + ',' + c
      for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffffffff
      return (hash & 1) === 1
    })
  )
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <rect width={size} height={size} fill="white" />
      {grid.flatMap((row, r) =>
        row.map((on, c) =>
          on ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill="#0B7070" /> : null
        )
      )}
    </svg>
  )
}

// ── Check-in QR Panel (slide-in from right) ────────────────────────────────────
function CheckInPanel({ patient, queuePosition, totalWaiting, onClose, onCheckIn }: {
  patient: Patient
  queuePosition: number
  totalWaiting: number
  onClose: () => void
  onCheckIn: () => void
}) {
  const [checked, setChecked] = useState(patient.status === 'checked-in' || patient.status === 'nurse-exam' || patient.status === 'with-doctor' || patient.status === 'completed')
  const [showPatientView, setShowPatientView] = useState(false)

  const qrValue = `swasthiq:checkin:${patient.id}:${patient.token}`
  const waitMins = queuePosition * 12 // rough estimate

  const handleCheckIn = () => {
    setChecked(true)
    onCheckIn()
  }

  if (showPatientView) {
    return (
      <PatientWaitingPage
        patient={patient}
        queuePosition={queuePosition}
        totalWaiting={totalWaiting}
        waitMins={waitMins}
        clinicName={CLINIC.name}
        onBack={() => setShowPatientView(false)}
      />
    )
  }

  const sc = STATUS_CFG[patient.status]

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full z-50 bg-white flex flex-col shadow-2xl"
        style={{ width: 400, borderLeft: '1px solid #E5E7EB' }}>

        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="font-700 text-gray-900 text-sm" style={{ fontFamily: 'var(--font-display)' }}>Patient Check-in</p>
            <p className="text-xs text-gray-400 mt-0.5">Generate QR · share with patient</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">

          {/* Patient summary */}
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: '#F8FAFB', border: '1px solid #E5E7EB' }}>
            <Avatar name={patient.name} size={42} />
            <div className="flex-1 min-w-0">
              <p className="font-700 text-gray-900 text-sm truncate" style={{ fontFamily: 'var(--font-display)' }}>{patient.name}</p>
              <p className="text-xs text-gray-400">{patient.age}y · {patient.gender} · {patient.id}</p>
              <p className="text-xs text-gray-500 mt-0.5">{patient.doctor}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-lg font-700" style={{ fontFamily: 'var(--font-mono)', color: '#0B7070' }}>{patient.token}</span>
              <span className="text-xs font-600 px-2 py-0.5 rounded-full" style={{ background: sc.bg, color: sc.text, fontFamily: 'var(--font-display)' }}>
                {sc.label}
              </span>
            </div>
          </div>

          {/* QR code */}
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="p-4 rounded-2xl" style={{ border: '2px solid #E6F4F4', background: 'white' }}>
              <QRCodeSVG value={qrValue} size={176} />
            </div>
            <div className="text-center">
              <p className="text-sm font-600 text-gray-700" style={{ fontFamily: 'var(--font-display)' }}>
                Ask patient to scan this QR
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Opens live waiting status on their phone</p>
            </div>
          </div>

          {/* Wait estimate */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Queue Position', value: `#${queuePosition}`, color: '#0B7070' },
              { label: 'Est. Wait', value: `~${waitMins} min`, color: '#D97706' },
              { label: 'Ahead', value: `${queuePosition - 1} patient${queuePosition > 2 ? 's' : ''}`, color: '#6B7280' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: '#F8FAFB', border: '1px solid #E5E7EB' }}>
                <p className="text-base font-700 leading-none" style={{ fontFamily: 'var(--font-display)', color }}>{value}</p>
                <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'var(--font-body)' }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Send via WhatsApp */}
          <div className="flex flex-col gap-2">
            <button className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-600 border transition-colors hover:opacity-90"
              style={{ background: '#E9FCF0', color: '#15803D', border: '1px solid #86EFAC', fontFamily: 'var(--font-display)' }}>
              <WhatsAppIcon size={15} />
              Send check-in link via WhatsApp
            </button>
            <button
              onClick={() => setShowPatientView(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-600 border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ fontFamily: 'var(--font-display)' }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="12" height="16" rx="2"/><path d="M7 6h6M7 10h6M7 14h4"/></svg>
              Preview patient's waiting page
            </button>
          </div>
        </div>

        {/* Check-in action */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
          {checked ? (
            <div className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-600"
              style={{ background: '#ECFDF5', color: '#065F46', fontFamily: 'var(--font-display)' }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M4 10l4 4 8-8"/></svg>
              Patient checked in
            </div>
          ) : (
            <button onClick={handleCheckIn}
              className="w-full py-3 rounded-xl text-sm font-700 text-white transition-opacity hover:opacity-90"
              style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
              Confirm Check-in
            </button>
          )}
          <p className="text-xs text-center text-gray-400 mt-2" style={{ fontFamily: 'var(--font-body)' }}>
            Check-in updates patient status &amp; starts wait timer
          </p>
        </div>
      </div>
    </>
  )
}

// ── Patient Waiting Page (mobile view) ─────────────────────────────────────────
const HEALTH_TIPS = [
  { title: 'Stay Hydrated', body: 'Drink at least 8 glasses of water daily. Dehydration can worsen most conditions.' },
  { title: 'Blood Pressure Check', body: 'For accurate readings, rest quietly for 5 minutes before measurement. Avoid caffeine beforehand.' },
  { title: 'Medication Timing', body: 'Always take medicines at the same time each day. Set a phone reminder if needed.' },
  { title: 'Know Your Numbers', body: 'Normal BP: 120/80 · Fasting sugar: 70–100 mg/dL · BMI: 18.5–24.9' },
  { title: 'Prepare for Your Visit', body: 'Bring any previous reports, prescriptions, or test results. List your symptoms with duration.' },
]

function PatientWaitingPage({ patient, queuePosition, totalWaiting, waitMins, clinicName, onBack }: {
  patient: Patient; queuePosition: number; totalWaiting: number
  waitMins: number; clinicName: string; onBack?: () => void
}) {
  const [tipIndex, setTipIndex] = useState(0)
  const [steppedOut, setSteppedOut] = useState(false)
  const tip = HEALTH_TIPS[tipIndex]

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', zIndex: 60 }}>
      {/* Phone frame */}
      <div className="relative flex flex-col bg-white overflow-hidden"
        style={{ width: 360, maxHeight: '90vh', borderRadius: 32, boxShadow: '0 32px 80px rgba(0,0,0,0.4)' }}>

        {/* Back button (preview only) */}
        {onBack && (
          <button onClick={onBack}
            className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-full text-xs font-600"
            style={{ background: 'rgba(0,0,0,0.5)', color: 'white', fontFamily: 'var(--font-display)' }}>
            ✕ Close preview
          </button>
        )}

        {/* Clinic header */}
        <div className="px-6 pt-8 pb-5 flex flex-col items-center text-center"
          style={{ background: 'linear-gradient(160deg, #0B7070 0%, #085858 100%)' }}>
          <div className="w-14 h-14 rounded-2xl overflow-hidden mb-3 bg-white flex items-center justify-center">
            <img src={CLINIC.logoUrl} alt={CLINIC.name} className="w-full h-full object-contain" />
          </div>
          <p className="text-white font-700 text-base" style={{ fontFamily: 'var(--font-display)' }}>{clinicName}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-body)' }}>Patient Waiting Room</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Token + name */}
          <div className="px-6 py-5 flex items-center gap-4 border-b border-gray-100">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#E6F4F4', border: '2px solid #0B7070' }}>
              <span className="text-xl font-800" style={{ fontFamily: 'var(--font-mono)', color: '#0B7070' }}>{patient.token}</span>
            </div>
            <div>
              <p className="font-700 text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>{patient.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{patient.doctor}</p>
              <p className="text-xs text-gray-500 mt-0.5">{patient.reason}</p>
            </div>
          </div>

          {/* Live queue status */}
          <div className="px-6 py-5">
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E5E7EB' }}>
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ background: steppedOut ? '#FFF7ED' : '#F0FDF4', borderBottom: '1px solid #E5E7EB' }}>
                <div>
                  <p className="text-xs font-600 text-gray-500 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>
                    {steppedOut ? 'You stepped out' : 'Your position'}
                  </p>
                  <p className="text-4xl font-800 leading-none mt-1"
                    style={{ fontFamily: 'var(--font-display)', color: steppedOut ? '#C2410C' : '#0B7070' }}>
                    #{queuePosition}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-600 text-gray-500 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>Est. wait</p>
                  <p className="text-2xl font-700 mt-1 leading-none" style={{ fontFamily: 'var(--font-display)', color: '#D97706' }}>
                    ~{waitMins}<span className="text-sm font-500"> min</span>
                  </p>
                </div>
              </div>

              {/* Queue visual */}
              <div className="px-5 py-4">
                <p className="text-xs text-gray-400 mb-3" style={{ fontFamily: 'var(--font-body)' }}>
                  {queuePosition - 1} patient{queuePosition > 2 ? 's' : ''} ahead · {totalWaiting} total today
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: Math.min(totalWaiting, 10) }).map((_, i) => (
                    <div key={i} className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-700"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        background: i < queuePosition - 1 ? '#ECFDF5' : i === queuePosition - 1 ? '#0B7070' : '#F3F4F6',
                        color: i < queuePosition - 1 ? '#10B981' : i === queuePosition - 1 ? 'white' : '#D1D5DB',
                        fontSize: 10,
                      }}>
                      {i < queuePosition - 1 ? '✓' : i === queuePosition - 1 ? patient.token : '·'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Health tip carousel */}
          <div className="px-6 pb-4">
            <div className="rounded-2xl p-5" style={{ background: '#F8FAFB', border: '1px solid #E5E7EB' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-700 uppercase tracking-wider text-gray-400" style={{ fontFamily: 'var(--font-display)' }}>
                  Health Tip
                </p>
                <div className="flex gap-1">
                  {HEALTH_TIPS.map((_, i) => (
                    <button key={i} onClick={() => setTipIndex(i)}
                      className="w-1.5 h-1.5 rounded-full transition-colors"
                      style={{ background: i === tipIndex ? '#0B7070' : '#D1D5DB' }} />
                  ))}
                </div>
              </div>
              <p className="text-sm font-700 text-gray-800 mb-1" style={{ fontFamily: 'var(--font-display)' }}>{tip.title}</p>
              <p className="text-xs text-gray-500 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>{tip.body}</p>
              <div className="flex justify-between mt-3">
                <button onClick={() => setTipIndex(i => (i - 1 + HEALTH_TIPS.length) % HEALTH_TIPS.length)}
                  className="text-xs font-600 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                  style={{ fontFamily: 'var(--font-display)' }}>← Prev</button>
                <button onClick={() => setTipIndex(i => (i + 1) % HEALTH_TIPS.length)}
                  className="text-xs font-600 px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors"
                  style={{ fontFamily: 'var(--font-display)' }}>Next →</button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-6 pb-8 flex flex-col gap-2">
            <button
              onClick={() => setSteppedOut(v => !v)}
              className="w-full py-3 rounded-2xl text-sm font-600 border transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                background: steppedOut ? '#FFF7ED' : 'white',
                color: steppedOut ? '#C2410C' : '#6B7280',
                borderColor: steppedOut ? '#FED7AA' : '#E5E7EB',
              }}>
              {steppedOut ? '↩ I\'m back — resume my spot' : '🚶 I need to step out briefly'}
            </button>
            <button className="w-full py-3 rounded-2xl text-sm font-600 border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              style={{ fontFamily: 'var(--font-display)' }}>
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 2l16 8-16 8V2zm0 8h16"/></svg>
              Call clinic
            </button>
          </div>
        </div>

        {/* Powered by */}
        <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-center gap-1.5 flex-shrink-0">
          <div className="w-4 h-4 rounded flex items-center justify-center text-white font-700"
            style={{ background: '#0B7070', fontSize: 8, fontFamily: 'var(--font-display)' }}>S</div>
          <p className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-body)' }}>
            Powered by <span className="font-500 text-gray-500">SwasthIQ</span>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Lab reports mock data ──────────────────────────────────────────────────────
interface LabReport {
  id: string
  name: string
  type: 'xray' | 'mri' | 'blood' | 'report' | 'prescription'
  date: string
  size: string
  uploadedBy: 'patient' | 'front-desk' | 'doctor'
  url?: string
}

const MOCK_REPORTS: Record<string, LabReport[]> = {
  'P-2841': [
    { id: 'r1', name: 'Knee X-Ray — Bilateral', type: 'xray', date: '2025-07-28', size: '2.4 MB', uploadedBy: 'patient' },
    { id: 'r2', name: 'Post-op MRI Report',      type: 'mri',  date: '2025-06-14', size: '8.1 MB', uploadedBy: 'doctor' },
    { id: 'r3', name: 'Blood Report — CBC',       type: 'blood',date: '2025-07-01', size: '0.3 MB', uploadedBy: 'front-desk' },
  ],
  'P-3501': [
    { id: 'r4', name: 'Lumbar Spine MRI',         type: 'mri',  date: '2025-08-01', size: '11.2 MB', uploadedBy: 'patient' },
  ],
  'P-1834': [
    { id: 'r5', name: 'Hip X-Ray AP View',        type: 'xray', date: '2025-07-20', size: '1.8 MB', uploadedBy: 'front-desk' },
    { id: 'r6', name: 'Consultant Letter',         type: 'report',date:'2025-07-22', size: '0.1 MB', uploadedBy: 'doctor' },
  ],
}

const REPORT_TYPE_CFG: Record<LabReport['type'], { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  xray:         { label: 'X-Ray',        bg: '#EFF6FF', text: '#1D4ED8', icon: <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 1 1 0 16A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12A6 6 0 0 0 10 4zm-1 3h2v3h3v2h-3v3H9v-3H6v-2h3V7z"/></svg> },
  mri:          { label: 'MRI',          bg: '#F5F3FF', text: '#6D28D9', icon: <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 1 1 0 16A8 8 0 0 1 10 2zm0 2a6 6 0 1 0 0 12A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm0 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg> },
  blood:        { label: 'Blood Test',   bg: '#FFF1F2', text: '#BE123C', icon: <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2s-6 6.5-6 10a6 6 0 0 0 12 0C16 8.5 10 2 10 2z"/></svg> },
  report:       { label: 'Report',       bg: '#F0FDF4', text: '#15803D', icon: <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M5 2h7l4 4v12H4V2h1zm6 0v4h4M7 9h6M7 12h6M7 15h4"/></svg> },
  prescription: { label: 'Prescription', bg: '#FFF7ED', text: '#C2410C', icon: <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M6 2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm1 4v2h6V6H7zm0 4v2h6v-2H7zm0 4v2h4v-2H7z"/></svg> },
}

// ── Patient Profile Page ───────────────────────────────────────────────────────
function PatientProfilePage({ patient, patients, onClose, onCheckIn }: {
  patient: Patient
  patients: Patient[]
  onClose: () => void
  onCheckIn: () => void
}) {
  const [showQR, setShowQR]           = useState(false)
  const [reports, setReports]         = useState<LabReport[]>(MOCK_REPORTS[patient.id] ?? [])
  const [dragOver, setDragOver]       = useState(false)
  const [uploading, setUploading]     = useState(false)
  const fileInputRef                  = React.useRef<HTMLInputElement>(null)

  const sc = STATUS_CFG[patient.status]

  const waitingBefore = patients.filter(p => p.status === 'waiting' || p.status === 'checked-in')
  const queuePosition = waitingBefore.findIndex(p => p.id === patient.id) + 1 || 1
  const totalWaiting  = waitingBefore.length
  const waitMins      = queuePosition * 12

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    setTimeout(() => {
      const newReports: LabReport[] = Array.from(files).map((f, i) => ({
        id: `upload-${Date.now()}-${i}`,
        name: f.name.replace(/\.[^/.]+$/, ''),
        type: f.name.match(/\.(jpg|jpeg|png)$/i) ? 'xray' : 'report',
        date: new Date().toISOString().split('T')[0],
        size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
        uploadedBy: 'front-desk',
      }))
      setReports(prev => [...newReports, ...prev])
      setUploading(false)
    }, 900)
  }

  if (showQR) {
    return (
      <CheckInPanel
        patient={patient}
        queuePosition={queuePosition}
        totalWaiting={totalWaiting}
        onClose={() => setShowQR(false)}
        onCheckIn={() => { onCheckIn(); setShowQR(false) }}
      />
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(4px)' }}>
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Drawer */}
      <div className="flex flex-col bg-white h-full overflow-hidden shadow-2xl"
        style={{ width: 520, borderLeft: '1px solid #E5E7EB' }}>

        {/* ── Header ── */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-start gap-4 flex-shrink-0">
          <Avatar name={patient.name} size={44} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-700 text-gray-900 text-base" style={{ fontFamily: 'var(--font-display)' }}>
                {patient.name}
              </h2>
              {patient.isNew && (
                <span className="text-xs px-1.5 py-0.5 rounded font-600" style={{ background: '#E6F4F4', color: '#0B7070', fontFamily: 'var(--font-display)' }}>NEW</span>
              )}
              {patient.priority === 'urgent' && (
                <span className="text-xs px-1.5 py-0.5 rounded font-600 bg-rose-50 text-rose-600" style={{ fontFamily: 'var(--font-display)' }}>URGENT</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-gray-400">{patient.age}y · {patient.gender} · {patient.id}</span>
              <span className="inline-flex items-center gap-1 text-xs font-600 px-2 py-0.5 rounded-full"
                style={{ background: sc.bg, color: sc.text, fontFamily: 'var(--font-display)' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                {sc.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xl font-700" style={{ fontFamily: 'var(--font-mono)', color: '#0B7070' }}>{patient.token}</span>
            <button onClick={onClose} className="ml-2 p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <CloseIcon />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">

          {/* Patient details */}
          <div className="px-6 py-5 border-b border-gray-50">
            <p className="text-xs font-700 uppercase tracking-widest text-gray-400 mb-3" style={{ fontFamily: 'var(--font-display)' }}>Patient Details</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Mobile',      value: patient.phone },
                { label: 'Doctor',      value: patient.doctor },
                { label: 'Arrived',     value: patient.arrivalTime },
                { label: 'Priority',    value: patient.priority.charAt(0).toUpperCase() + patient.priority.slice(1) },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl px-3 py-2.5" style={{ background: '#F8FAFB', border: '1px solid #F0F0F0' }}>
                  <p className="text-xs text-gray-400 mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>{label}</p>
                  <p className="text-sm font-600 text-gray-800" style={{ fontFamily: label === 'Mobile' ? 'var(--font-mono)' : 'var(--font-body)' }}>{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl px-3 py-2.5" style={{ background: '#F8FAFB', border: '1px solid #F0F0F0' }}>
              <p className="text-xs text-gray-400 mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>Chief Complaint</p>
              <p className="text-sm font-500 text-gray-800" style={{ fontFamily: 'var(--font-body)' }}>{patient.reason}</p>
            </div>
          </div>

          {/* Queue position */}
          {(patient.status === 'waiting' || patient.status === 'checked-in') && (
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-4">
              <div className="flex-1 flex items-center gap-3">
                <div className="text-center">
                  <p className="text-2xl font-800 leading-none" style={{ fontFamily: 'var(--font-display)', color: '#0B7070' }}>#{queuePosition}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Position</p>
                </div>
                <div className="h-8 w-px bg-gray-100" />
                <div className="text-center">
                  <p className="text-2xl font-800 leading-none" style={{ fontFamily: 'var(--font-display)', color: '#D97706' }}>~{waitMins}m</p>
                  <p className="text-xs text-gray-400 mt-0.5">Est. wait</p>
                </div>
              </div>
              {patient.status === 'waiting' && (
                <button onClick={() => setShowQR(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 text-white transition-opacity hover:opacity-90"
                  style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
                  <svg width="15" height="15" viewBox="0 0 20 20" fill="currentColor"><path d="M2 2h7v7H2V2zm9 0h7v7h-7V2zM2 11h7v7H2v-7zm9 2h2v2h-2v-2zm2-2h2v2h-2v-2zm2 2h2v2h-2v-2zm-2 2h2v2h-2v-2zm2 2h2v2h-2v-2zm-4 0h2v2h-2v-2z"/></svg>
                  Check In / QR
                </button>
              )}
            </div>
          )}

          {/* Lab Reports */}
          <div className="px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-700 uppercase tracking-widest text-gray-400" style={{ fontFamily: 'var(--font-display)' }}>Lab Reports & Documents</p>
                <p className="text-xs text-gray-400 mt-0.5">{reports.length} file{reports.length !== 1 ? 's' : ''} on record</p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 border border-dashed transition-colors hover:bg-teal-50"
                style={{ borderColor: '#0B7070', color: '#0B7070', fontFamily: 'var(--font-display)' }}>
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10 4v12M4 10h12"/></svg>
                Upload
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.dcm"
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
            </div>

            {/* Drag-drop zone */}
            <div
              className="rounded-2xl border-2 border-dashed mb-4 flex flex-col items-center justify-center py-6 transition-colors cursor-pointer"
              style={{
                borderColor: dragOver ? '#0B7070' : '#E5E7EB',
                background: dragOver ? '#E6F4F4' : '#FAFAFA',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
                  <p className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-body)' }}>Uploading…</p>
                </div>
              ) : (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#0B7070' : '#9CA3AF'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  <p className="text-xs font-600 text-gray-500" style={{ fontFamily: 'var(--font-display)' }}>Drop files here or click to upload</p>
                  <p className="text-xs text-gray-400 mt-0.5">PDF, JPG, PNG · X-rays, MRI, blood reports</p>
                </>
              )}
            </div>

            {/* Report list */}
            {reports.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p className="text-sm" style={{ fontFamily: 'var(--font-display)' }}>No reports uploaded yet</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {reports.map(r => {
                  const tc = REPORT_TYPE_CFG[r.type]
                  return (
                    <div key={r.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors group">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: tc.bg, color: tc.text }}>
                        {tc.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-600 text-gray-800 truncate" style={{ fontFamily: 'var(--font-display)' }}>{r.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs px-1.5 py-0.5 rounded font-600" style={{ background: tc.bg, color: tc.text, fontFamily: 'var(--font-display)' }}>
                            {tc.label}
                          </span>
                          <span className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-mono)' }}>{r.date}</span>
                          <span className="text-xs text-gray-400">{r.size}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-400" style={{ fontFamily: 'var(--font-display)' }}>
                            {r.uploadedBy === 'front-desk' ? 'Front Desk' : r.uploadedBy === 'doctor' ? 'Doctor' : 'Patient'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 rounded-lg hover:bg-teal-50 text-gray-400 hover:text-teal-600 transition-colors" title="View">
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 10s4-7 9-7 9 7 9 7-4 7-9 7-9-7-9-7z"/><circle cx="10" cy="10" r="3"/></svg>
                        </button>
                        <button className="p-1.5 rounded-lg hover:bg-teal-50 text-gray-400 hover:text-teal-600 transition-colors" title="Download">
                          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 3v10M5 13l5 5 5-5"/><path d="M3 18h14"/></svg>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-600 border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: 'var(--font-display)' }}>
            Close
          </button>
          <button
            className="flex-1 py-2.5 rounded-xl text-sm font-600 border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: 'var(--font-display)' }}>
            Edit Profile
          </button>
        </div>
      </div>
    </div>
  )
}

// ── New Appointment Modal ──────────────────────────────────────────────────────
const DOCTORS = ['Dr. Uday Pote', 'Dr. Himanshu Jain']
const PRIMARY_DOCTOR = DOCTORS[0]
const TODAY = new Date().toISOString().split('T')[0]
const TIME_SLOTS = ['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM','11:30 AM','12:00 PM','04:00 PM','04:30 PM','05:00 PM']
const VISIT_TYPES = ['New Consultation','Follow-up','Review / Report','Procedure','Health Check']

function AppointmentModal({ onClose }: { onClose: () => void }) {
  const [patientQuery, setPatientQuery]   = useState('')
  const [searchMode, setSearchMode]       = useState<'name' | 'phone'>('phone')
  const [doctor, setDoctor]               = useState(PRIMARY_DOCTOR)
  const [date, setDate]                   = useState(TODAY)
  const [slot, setSlot]                   = useState(TIME_SLOTS[0])
  const [visitType, setVisitType]         = useState(VISIT_TYPES[0])
  const [reason, setReason]               = useState('')

  const inputCls = "w-full px-3 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:border-teal-500 transition-colors bg-white text-gray-700 placeholder-gray-300"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="font-700 text-gray-900 text-base" style={{ fontFamily: 'var(--font-display)' }}>Book Appointment</h2>
            <p className="text-xs text-gray-400 mt-0.5">Schedule a visit for a patient</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <CloseIcon />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">

          {/* ── Patient search ── */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-600 text-gray-500" style={{ fontFamily: 'var(--font-display)' }}>
                Patient
              </label>
              {/* Toggle search mode */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                {(['phone', 'name'] as const).map(mode => (
                  <button key={mode}
                    onClick={() => { setSearchMode(mode); setPatientQuery('') }}
                    className="px-2.5 py-1 rounded-md text-xs font-600 transition-colors"
                    style={{
                      fontFamily: 'var(--font-display)',
                      background: searchMode === mode ? 'white' : 'transparent',
                      color: searchMode === mode ? '#0B7070' : '#6B7280',
                      boxShadow: searchMode === mode ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}>
                    {mode === 'phone' ? 'By Phone' : 'By Name'}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <SearchIcon />
              </span>
              <input
                value={patientQuery}
                onChange={e => setPatientQuery(e.target.value)}
                placeholder={searchMode === 'phone' ? 'Enter mobile number…' : 'Enter patient name…'}
                type={searchMode === 'phone' ? 'tel' : 'text'}
                className={inputCls}
                style={{ paddingLeft: '2.25rem', fontFamily: 'var(--font-body)' }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1" style={{ fontFamily: 'var(--font-body)' }}>
              {searchMode === 'phone'
                ? 'Default search — quickest way to pull up returning patients'
                : 'Type at least 3 characters to match'}
            </p>
          </div>

          {/* ── Doctor ── */}
          <div>
            <label className="block text-xs font-600 text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
              Doctor <span className="font-400 text-gray-400">(primary doctor pre-selected)</span>
            </label>
            <select value={doctor} onChange={e => setDoctor(e.target.value)} className={inputCls} style={{ fontFamily: 'var(--font-body)' }}>
              {DOCTORS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>

          {/* ── Date + Time slot ── */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
                Date <span className="font-400 text-gray-400">(today)</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className={inputCls}
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>Time Slot</label>
              <select value={slot} onChange={e => setSlot(e.target.value)} className={inputCls} style={{ fontFamily: 'var(--font-body)' }}>
                {TIME_SLOTS.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* ── Visit type ── */}
          <div>
            <label className="block text-xs font-600 text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>Visit Type</label>
            <div className="flex flex-wrap gap-2">
              {VISIT_TYPES.map(vt => (
                <button key={vt}
                  onClick={() => setVisitType(vt)}
                  className="px-3 py-1.5 rounded-xl text-xs font-600 border transition-colors"
                  style={{
                    fontFamily: 'var(--font-display)',
                    background: visitType === vt ? '#E6F4F4' : 'white',
                    color: visitType === vt ? '#0B7070' : '#6B7280',
                    borderColor: visitType === vt ? '#0B7070' : '#E5E7EB',
                  }}>
                  {vt}
                </button>
              ))}
            </div>
          </div>

          {/* ── Reason for visit ── */}
          <div>
            <label className="block text-xs font-600 text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>
              Reason for Visit <span className="font-400 text-gray-400">(optional)</span>
            </label>
            <input
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. Chest pain since 2 days, routine check…"
              className={inputCls}
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button onClick={onClose}
            className="px-4 py-2.5 text-sm font-600 text-gray-600 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            style={{ fontFamily: 'var(--font-display)' }}>
            Cancel
          </button>
          <button onClick={onClose}
            className="px-5 py-2.5 text-sm font-600 text-white rounded-xl transition-opacity hover:opacity-90"
            style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
            Confirm Appointment
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Doctor Dashboard ───────────────────────────────────────────────────────────
const UPCOMING_SESSION = { time: '17:00', count: 8 }

const PREV_APPTS: Record<string, number> = {
  'P-2841': 7, 'P-3192': 4, 'P-4015': 0, 'P-4823': 12, 'P-5107': 0,
  'P-5340': 3, 'P-5701': 1, 'P-6012': 8, 'P-6219': 0, 'P-6488': 2,
}

const LAB_REPORTS: Record<string, boolean> = {
  'P-2841': true, 'P-4823': true, 'P-6012': true,
}

function useTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) { setElapsed(0); return }
    setElapsed(0)
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  const fmt = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }
  return fmt(elapsed)
}

// ── Consultation Page ──────────────────────────────────────────────────────────
const VITALS: Record<string, { bp: string; pulse: string; temp: string; spo2: string; weight: string; height: string }> = {
  'P-2841': { bp: '138/88', pulse: '76', temp: '98.4', spo2: '98', weight: '82', height: '172' },
  'P-4008': { bp: '122/78', pulse: '82', temp: '98.6', spo2: '99', weight: '75', height: '178' },
}

const VISIT_HISTORY: Record<string, { date: string; summary: string; doctor: string }[]> = {
  'P-2841': [
    { date: '14 Jun 2025', summary: 'Right knee arthroplasty — post-op day 21. Wound healing well. ROM 0–90°.', doctor: 'Dr. Uday Pote' },
    { date: '24 May 2025', summary: 'Pre-op assessment. Blood work, ECG reviewed. Surgery scheduled.', doctor: 'Dr. Uday Pote' },
    { date: '10 Apr 2025', summary: 'Severe OA grade IV right knee. Conservative management failed. Surgery advised.', doctor: 'Dr. Uday Pote' },
  ],
  'P-4008': [
    { date: '02 Aug 2025', summary: 'ACL sprain grade II. MRI confirmed. RICE + physio referral given.', doctor: 'Dr. Uday Pote' },
  ],
}

const ICD_SUGGESTIONS: Record<string, { code: string; label: string }[]> = {
  'P-2841': [
    { code: 'M17.11', label: 'Primary osteoarthritis, right knee' },
    { code: 'Z96.651', label: 'Presence of right artificial knee joint' },
    { code: 'Z47.1', label: 'Aftercare following joint replacement surgery' },
  ],
  'P-4008': [
    { code: 'S83.511', label: 'Sprain of anterior cruciate ligament, right knee' },
    { code: 'M23.619', label: 'Other spontaneous disruption of anterior cruciate ligament' },
  ],
}

const MEDICINE_DB = [
  { name: 'Tab. Etoricoxib 90mg',         dose: '1-0-1', duration: '5 days',  notes: 'After food' },
  { name: 'Tab. Etoricoxib 60mg',         dose: '0-0-1', duration: '5 days',  notes: 'After food' },
  { name: 'Tab. Diclofenac 50mg',         dose: '1-0-1', duration: '5 days',  notes: 'After food' },
  { name: 'Tab. Aceclofenac 100mg',       dose: '1-0-1', duration: '5 days',  notes: 'After food' },
  { name: 'Tab. Pantoprazole 40mg',       dose: '1-0-0', duration: '5 days',  notes: 'Before food' },
  { name: 'Tab. Rabeprazole 20mg',        dose: '1-0-0', duration: '5 days',  notes: 'Before food' },
  { name: 'Tab. Celecoxib 200mg',         dose: '1-0-1', duration: '5 days',  notes: 'After food' },
  { name: 'Tab. Tramadol 50mg',           dose: '0-0-1', duration: '3 days',  notes: 'After food, severe pain only' },
  { name: 'Tab. Tizanidine 2mg',          dose: '0-0-1', duration: '5 days',  notes: 'At bedtime' },
  { name: 'Tab. Methocarbamol 750mg',     dose: '1-0-1', duration: '5 days',  notes: 'After food' },
  { name: 'Cap. Pregabalin 75mg',         dose: '1-0-1', duration: '10 days', notes: 'After food' },
  { name: 'Cap. Pregabalin 150mg',        dose: '1-0-1', duration: '10 days', notes: 'After food' },
  { name: 'Tab. Methylcobalamin 500mcg',  dose: '1-0-1', duration: '30 days', notes: 'After food' },
  { name: 'Tab. Calcium + Vit D3',        dose: '0-1-0', duration: '30 days', notes: 'After food' },
  { name: 'Tab. Cholecalciferol 60000IU', dose: '1×/week', duration: '8 wks', notes: 'After food' },
  { name: 'Oint. Diclofenac Gel',         dose: 'Apply TDS', duration: '7 days', notes: 'Over affected area' },
  { name: 'Oint. Ketoprofen Gel',         dose: 'Apply BD',  duration: '7 days', notes: 'Over affected area' },
  { name: 'Inj. Methylprednisolone 40mg', dose: 'Single dose', duration: 'Once', notes: 'Intra-articular' },
  { name: 'Inj. Sodium Hyaluronate',      dose: 'Single dose', duration: 'Once', notes: 'Intra-articular' },
]

function PrescriptionPreview({ patient, prevCount, vitals, bmi, complaint, complaintHistory,
  generalExam, localExam, rom, specialTests, assessment, diagnosis, selectedICD,
  rx, advice, orderedTests, referral, followUp, onClose, onSend }: {
  patient: Patient; prevCount: number
  vitals: { bp: string; pulse: string; temp: string; spo2: string; weight: string; height: string }
  bmi: string; complaint: string; complaintHistory: string
  generalExam: string; localExam: string; rom: string; specialTests: string
  assessment: string; diagnosis: string; selectedICD: string
  rx: { drug: string; dose: string; duration: string; notes: string }[]
  advice: string; orderedTests: string[]; referral: string; followUp: string
  onClose: () => void; onSend: () => void
}) {
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

  const Block = ({ label, value }: { label: string; value: string }) =>
    value ? (
      <div className="mb-3">
        <p className="text-xs font-700 uppercase tracking-wider mb-1" style={{ color: '#6B7280', fontFamily: 'var(--font-display)' }}>{label}</p>
        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'var(--font-body)' }}>{value}</p>
      </div>
    ) : null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ width: 720, maxHeight: '90vh' }}>

        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <p className="font-700 text-gray-900 text-sm" style={{ fontFamily: 'var(--font-display)' }}>Prescription Preview</p>
          <div className="flex items-center gap-2">
            <button onClick={onSend}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-600 text-white transition-opacity hover:opacity-90"
              style={{ background: '#25D366', fontFamily: 'var(--font-display)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.845L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-4.964-1.348l-.356-.211-3.762.981.999-3.671-.232-.376A9.818 9.818 0 1112 21.818z"/></svg>
              Send
            </button>
            <button
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-600 border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              style={{ fontFamily: 'var(--font-display)' }}>
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm1-4h4v4H10v-4z"/></svg>
              Print
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Document */}
        <div className="overflow-y-auto flex-1 px-10 py-8" style={{ background: '#F8FAFC' }}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Clinic / Doctor header */}
            <div className="px-8 py-6 flex items-start justify-between" style={{ background: 'linear-gradient(135deg, #0B7070 0%, #085858 100%)' }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white p-1">
                  <img src={CLINIC.logoUrl} alt={CLINIC.name} className="w-full h-full object-contain" />
                </div>
                <div>
                  <p className="font-800 text-white text-lg leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{CLINIC.name}</p>
                  <p className="text-sm text-teal-200" style={{ fontFamily: 'var(--font-body)' }}>{CLINIC.tagline}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-700 text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>Dr. Uday Pote</p>
                <p className="text-xs text-teal-200">Orthopedic Surgeon & Spine Specialist</p>
                <p className="text-xs text-teal-300 mt-1" style={{ fontFamily: 'var(--font-mono)' }}>{date}</p>
              </div>
            </div>

            {/* Patient info bar */}
            <div className="px-8 py-4 border-b border-gray-100 grid grid-cols-4 gap-4" style={{ background: '#F9FAFB' }}>
              {[
                { label: 'Patient', value: patient.name },
                { label: 'Age / Gender', value: `${patient.age}y · ${patient.gender === 'M' ? 'Male' : 'Female'}` },
                { label: 'Patient ID', value: patient.id },
                { label: 'Visit Type', value: patient.isNew ? 'New Consultation' : `Follow-up #${prevCount}` },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-xs text-gray-400 mb-0.5" style={{ fontFamily: 'var(--font-body)' }}>{f.label}</p>
                  <p className="text-sm font-700 text-gray-800" style={{ fontFamily: 'var(--font-display)' }}>{f.value}</p>
                </div>
              ))}
            </div>

            <div className="px-8 py-6 flex gap-8">

              {/* Left column */}
              <div className="flex-1 min-w-0">

                {/* Vitals */}
                <div className="mb-5">
                  <p className="text-xs font-700 uppercase tracking-wider mb-2 pb-1 border-b border-gray-100" style={{ color: '#0B7070', fontFamily: 'var(--font-display)' }}>Vitals</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: 'BP', value: `${vitals.bp} mmHg`, warn: parseInt(vitals.bp) > 130 },
                      { label: 'Pulse', value: `${vitals.pulse} bpm`, warn: false },
                      { label: 'Temp', value: `${vitals.temp}°F`, warn: parseFloat(vitals.temp) > 99 },
                      { label: 'SpO₂', value: `${vitals.spo2}%`, warn: false },
                      { label: 'Weight', value: `${vitals.weight} kg`, warn: false },
                      { label: 'Height', value: `${vitals.height} cm`, warn: false },
                      { label: 'BMI', value: bmi, warn: false },
                    ].map(v => (
                      <div key={v.label} className="rounded-lg px-2.5 py-2" style={{ background: v.warn ? '#FFF7ED' : '#F9FAFB' }}>
                        <p className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-body)' }}>{v.label}</p>
                        <p className="text-sm font-700" style={{ fontFamily: 'var(--font-display)', color: v.warn ? '#D97706' : '#111827' }}>{v.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clinical notes */}
                <div className="mb-5">
                  <p className="text-xs font-700 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100" style={{ color: '#7C3AED', fontFamily: 'var(--font-display)' }}>Clinical Notes</p>
                  <Block label="Chief Complaint" value={complaint} />
                  <Block label="History" value={complaintHistory} />
                </div>

                {(generalExam || localExam || rom || specialTests) && (
                  <div className="mb-5">
                    <p className="text-xs font-700 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100" style={{ color: '#0284C7', fontFamily: 'var(--font-display)' }}>On Examination</p>
                    <Block label="General Appearance" value={generalExam} />
                    <Block label="Local Examination" value={localExam} />
                    <Block label="Range of Motion" value={rom} />
                    <Block label="Special Tests" value={specialTests} />
                  </div>
                )}

                {(assessment || diagnosis) && (
                  <div className="mb-5">
                    <p className="text-xs font-700 uppercase tracking-wider mb-3 pb-1 border-b border-gray-100" style={{ color: '#059669', fontFamily: 'var(--font-display)' }}>Assessment</p>
                    <Block label="Assessment & Plan" value={assessment} />
                    {diagnosis && (
                      <div className="mb-3">
                        <p className="text-xs font-700 uppercase tracking-wider mb-1" style={{ color: '#6B7280', fontFamily: 'var(--font-display)' }}>Diagnosis</p>
                        <div className="flex items-center gap-2">
                          {selectedICD && <span className="text-xs font-700 px-2 py-0.5 rounded" style={{ background: '#E6F4F4', color: '#0B7070', fontFamily: 'var(--font-mono)' }}>{selectedICD}</span>}
                          <span className="text-sm text-gray-700" style={{ fontFamily: 'var(--font-body)' }}>{diagnosis}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="w-px bg-gray-100 flex-shrink-0" />

              {/* Right column — Rx */}
              <div className="w-56 flex-shrink-0">

                {/* Rx symbol */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-3xl font-800 leading-none" style={{ fontFamily: 'var(--font-display)', color: '#0B7070' }}>℞</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Medications */}
                <div className="mb-4">
                  {rx.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No medications added</p>
                  ) : rx.map((med, i) => (
                    <div key={i} className="mb-3 pb-3 border-b border-gray-50 last:border-0">
                      <p className="text-sm font-700 text-gray-900 leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                        {i + 1}. {med.drug}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>{med.dose} × {med.duration}</p>
                      {med.notes && <p className="text-xs text-gray-400 italic">{med.notes}</p>}
                    </div>
                  ))}
                </div>

                {/* Advice */}
                {advice && (
                  <div className="mb-4">
                    <p className="text-xs font-700 uppercase tracking-wider mb-1.5" style={{ color: '#059669', fontFamily: 'var(--font-display)' }}>Advice</p>
                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap" style={{ fontFamily: 'var(--font-body)' }}>{advice}</p>
                  </div>
                )}

                {/* Investigations */}
                {orderedTests.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-700 uppercase tracking-wider mb-1.5" style={{ color: '#4F46E5', fontFamily: 'var(--font-display)' }}>Investigations</p>
                    <ul className="flex flex-col gap-0.5">
                      {orderedTests.map(t => (
                        <li key={t} className="text-xs text-gray-600 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-indigo-400 flex-shrink-0" />
                          {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Referral */}
                {referral && (
                  <div className="mb-4">
                    <p className="text-xs font-700 uppercase tracking-wider mb-1" style={{ color: '#D97706', fontFamily: 'var(--font-display)' }}>Referral</p>
                    <p className="text-xs text-gray-600" style={{ fontFamily: 'var(--font-body)' }}>{referral}</p>
                  </div>
                )}

                {/* Follow-up */}
                <div className="mb-4">
                  <p className="text-xs font-700 uppercase tracking-wider mb-1" style={{ color: '#0284C7', fontFamily: 'var(--font-display)' }}>Follow-up</p>
                  <p className="text-xs text-gray-600" style={{ fontFamily: 'var(--font-body)' }}>{followUp}</p>
                </div>

                {/* Signature */}
                <div className="mt-8 pt-4 border-t border-gray-200 text-center">
                  <p className="text-xs font-700 text-gray-700" style={{ fontFamily: 'var(--font-display)' }}>Dr. Uday Pote</p>
                  <p className="text-xs text-gray-400">Orthopedic Surgeon</p>
                  <p className="text-xs text-gray-300 mt-0.5" style={{ fontFamily: 'var(--font-mono)' }}>Reg. No. MCI-XXXXX</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-8 py-3 border-t border-gray-100 flex items-center justify-between" style={{ background: '#F9FAFB' }}>
              <p className="text-xs text-gray-400">{CLINIC.name} · {CLINIC.tagline}</p>
              <p className="text-xs text-gray-300" style={{ fontFamily: 'var(--font-body)' }}>Powered by SwasthIQ</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SendDialog({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [recipients, setRecipients] = useState({
    patient: true,
    pharmacy: false,
    lab: false,
  })
  const [pharmacyName, setPharmacyName] = useState('')
  const [pharmacyPhone, setPharmacyPhone] = useState('')
  const [labName, setLabName] = useState('')
  const [labPhone, setLabPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSend = () => {
    setSending(true)
    setTimeout(() => { setSending(false); setSent(true) }, 1500)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="font-700 text-gray-900 text-sm" style={{ fontFamily: 'var(--font-display)' }}>Send Prescription</p>
            <p className="text-xs text-gray-400 mt-0.5">Choose recipients and confirm details</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {sent ? (
          <div className="px-6 py-10 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#ECFDF5' }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
            <p className="font-700 text-gray-800" style={{ fontFamily: 'var(--font-display)' }}>Prescription Sent!</p>
            <p className="text-sm text-gray-400">
              {[recipients.patient && patient.name, recipients.pharmacy && (pharmacyName || 'Pharmacy'), recipients.lab && (labName || 'Lab')].filter(Boolean).join(', ')} will receive the prescription via WhatsApp.
            </p>
            <button onClick={onClose} className="mt-2 px-5 py-2 rounded-xl text-sm font-600 text-white" style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>Done</button>
          </div>
        ) : (
          <div className="px-6 py-5 flex flex-col gap-4">
            {/* Patient */}
            <div className={`rounded-xl border p-4 transition-colors ${recipients.patient ? 'border-teal-300 bg-teal-50/30' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-3">
                <button onClick={() => setRecipients(r => ({ ...r, patient: !r.patient }))}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${recipients.patient ? 'border-teal-600 bg-teal-600' : 'border-gray-300'}`}>
                  {recipients.patient && <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                </button>
                <span className="text-sm font-700 text-gray-800" style={{ fontFamily: 'var(--font-display)' }}>Patient</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-500" style={{ background: '#25D36622', color: '#128C7E', fontFamily: 'var(--font-display)' }}>WhatsApp</span>
              </div>
              <div className="grid grid-cols-2 gap-2 ml-8">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Name</p>
                  <p className="text-sm font-600 text-gray-700" style={{ fontFamily: 'var(--font-display)' }}>{patient.name}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                  <p className="text-sm font-600 text-gray-700" style={{ fontFamily: 'var(--font-mono)' }}>{patient.phone}</p>
                </div>
              </div>
            </div>

            {/* Pharmacy */}
            <div className={`rounded-xl border p-4 transition-colors ${recipients.pharmacy ? 'border-indigo-300 bg-indigo-50/30' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-3">
                <button onClick={() => setRecipients(r => ({ ...r, pharmacy: !r.pharmacy }))}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${recipients.pharmacy ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'}`}>
                  {recipients.pharmacy && <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                </button>
                <span className="text-sm font-700 text-gray-800" style={{ fontFamily: 'var(--font-display)' }}>Pharmacy</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-500" style={{ background: '#25D36622', color: '#128C7E', fontFamily: 'var(--font-display)' }}>WhatsApp</span>
              </div>
              {recipients.pharmacy && (
                <div className="grid grid-cols-2 gap-2 ml-8">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Pharmacy Name</p>
                    <input value={pharmacyName} onChange={e => setPharmacyName(e.target.value)}
                      placeholder="e.g. MedPlus, Apollo"
                      className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-400 bg-white"
                      style={{ fontFamily: 'var(--font-body)' }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Phone</p>
                    <input value={pharmacyPhone} onChange={e => setPharmacyPhone(e.target.value)}
                      placeholder="98XXXXXXXX"
                      className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-indigo-400 bg-white"
                      style={{ fontFamily: 'var(--font-mono)' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Lab */}
            <div className={`rounded-xl border p-4 transition-colors ${recipients.lab ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'}`}>
              <div className="flex items-center gap-3 mb-3">
                <button onClick={() => setRecipients(r => ({ ...r, lab: !r.lab }))}
                  className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0 ${recipients.lab ? 'border-amber-500 bg-amber-500' : 'border-gray-300'}`}>
                  {recipients.lab && <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                </button>
                <span className="text-sm font-700 text-gray-800" style={{ fontFamily: 'var(--font-display)' }}>Lab / Diagnostics</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-500" style={{ background: '#25D36622', color: '#128C7E', fontFamily: 'var(--font-display)' }}>WhatsApp</span>
              </div>
              {recipients.lab && (
                <div className="grid grid-cols-2 gap-2 ml-8">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Lab Name</p>
                    <input value={labName} onChange={e => setLabName(e.target.value)}
                      placeholder="e.g. SRL, Thyrocare"
                      className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-amber-400 bg-white"
                      style={{ fontFamily: 'var(--font-body)' }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Phone</p>
                    <input value={labPhone} onChange={e => setLabPhone(e.target.value)}
                      placeholder="98XXXXXXXX"
                      className="w-full text-sm px-2.5 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:border-amber-400 bg-white"
                      style={{ fontFamily: 'var(--font-mono)' }} />
                  </div>
                </div>
              )}
            </div>

            <button onClick={handleSend}
              disabled={!recipients.patient && !recipients.pharmacy && !recipients.lab}
              className="w-full py-2.5 rounded-xl text-sm font-700 text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: '#25D366', fontFamily: 'var(--font-display)' }}>
              {sending ? (
                <><svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Sending…</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.528 5.845L0 24l6.335-1.652A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-4.964-1.348l-.356-.211-3.762.981.999-3.671-.232-.376A9.818 9.818 0 1112 21.818z"/></svg> Send via WhatsApp</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ChipField({ label, value, onChange, rows, placeholder, chips, chipColor, chipBg }: {
  label: string; value: string; onChange: (v: string) => void
  rows: number; placeholder?: string; chips: string[]
  chipColor: string; chipBg: string
}) {
  const append = (chip: string) => {
    onChange(value ? `${value.trimEnd()}, ${chip}` : chip)
  }
  return (
    <div>
      {label && <p className="text-xs font-600 text-gray-500 mb-1" style={{ fontFamily: 'var(--font-display)' }}>{label}</p>}
      <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:bg-white resize-none placeholder-gray-300 leading-relaxed transition-colors"
        style={{ fontFamily: 'var(--font-body)' }} />
      <div className="flex flex-wrap gap-1 mt-1.5">
        {chips.map(chip => (
          <button key={chip} type="button" onClick={() => append(chip)}
            className="text-xs px-2 py-0.5 rounded-md font-500 transition-opacity hover:opacity-70"
            style={{ background: chipBg, color: chipColor, fontFamily: 'var(--font-display)' }}>
            {chip}
          </button>
        ))}
      </div>
    </div>
  )
}

function SectionCard({ title, children, accent }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-2"
        style={{ background: accent ? accent + '08' : '#FAFAFA' }}>
        <p className="text-xs font-700 uppercase tracking-widest text-gray-500" style={{ fontFamily: 'var(--font-display)', color: accent ?? undefined }}>
          {title}
        </p>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function ConsultationPage({ patient, patients, consultSecs, onClose, onCallNext }: {
  patient: Patient
  patients: Patient[]
  consultSecs: number
  onClose: () => void
  onCallNext: () => void
}) {
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const vitals = VITALS[patient.id] ?? { bp: '—', pulse: '—', temp: '—', spo2: '—', weight: '—', height: '—' }
  const history = VISIT_HISTORY[patient.id] ?? []
  const icdList = ICD_SUGGESTIONS[patient.id] ?? []
  const prevCount = PREV_APPTS[patient.id] ?? 0
  const hasLab = LAB_REPORTS[patient.id] ?? false

  const [activeTab, setActiveTab] = useState<'clinical' | 'prescription'>('clinical')
  const [complaint, setComplaint] = useState(patient.reason)
  const [complaintHistory, setComplaintHistory] = useState('')
  const [generalExam, setGeneralExam]     = useState('')
  const [localExam, setLocalExam]         = useState('')
  const [rom, setRom]                     = useState('')
  const [specialTests, setSpecialTests]   = useState('')
  const [assessment, setAssessment]       = useState('')
  const [diagnosis, setDiagnosis]         = useState(icdList[0]?.label ?? '')
  const [selectedICD, setSelectedICD]     = useState(icdList[0]?.code ?? '')
  const [showICD, setShowICD]             = useState(false)
  const [advice, setAdvice]               = useState('Avoid weight bearing on right knee for 2 weeks. Ice pack 15 min × 3 daily. Physiotherapy sessions as referred.')
  const [followUp, setFollowUp]           = useState('2 weeks')
  const [referral, setReferral]           = useState('')
  const [rx, setRx] = useState([
    { drug: 'Tab. Etoricoxib 90mg',   dose: '1-0-1', duration: '5 days', notes: 'After food' },
    { drug: 'Tab. Pantoprazole 40mg', dose: '1-0-0', duration: '5 days', notes: 'Before food' },
  ])
  const [newDrug, setNewDrug]             = useState({ drug: '', dose: '', duration: '', notes: '' })
  const [orderedTests, setOrderedTests]   = useState<string[]>([])
  const [showSend, setShowSend] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [ocrState, setOcrState] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [showMedSuggestions, setShowMedSuggestions] = useState(false)

  const bmi = vitals.weight !== '—' && vitals.height !== '—'
    ? (parseFloat(vitals.weight) / Math.pow(parseFloat(vitals.height) / 100, 2)).toFixed(1)
    : '—'

  const tabs = [
    { key: 'clinical' as const,      label: 'Clinical Notes',         icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> },
    { key: 'prescription' as const,  label: 'Prescription & Orders',  icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> },
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#F4F7F9' }}>

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 flex-shrink-0 px-5 py-2.5 flex items-center gap-4">
        <button onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-teal-700 font-500 transition-colors flex-shrink-0"
          style={{ fontFamily: 'var(--font-display)' }}>
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Dashboard
        </button>
        <div className="h-6 w-px bg-gray-100" />

        <Avatar name={patient.name} size={34} />
        <div>
          <div className="flex items-center gap-2">
            <p className="font-700 text-gray-900 text-sm" style={{ fontFamily: 'var(--font-display)' }}>{patient.name}</p>
            {patient.isNew
              ? <span className="text-xs font-700 px-1.5 py-0.5 rounded" style={{ background: '#E6F4F4', color: '#0B7070', fontFamily: 'var(--font-display)' }}>NEW</span>
              : <span className="text-xs font-600 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600" style={{ fontFamily: 'var(--font-display)' }}>Follow-up #{prevCount}</span>
            }
          </div>
          <p className="text-xs text-gray-400">{patient.age}y · {patient.gender === 'M' ? 'Male' : 'Female'} · {patient.id} · {patient.phone}</p>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: '#ECFDF5' }}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
          <span className="font-700 text-sm" style={{ fontFamily: 'var(--font-mono)', color: '#059669' }}>{fmtTime(consultSecs)}</span>
        </div>

        <button onClick={() => setShowPreview(true)}
          className="px-3.5 py-2 rounded-xl text-sm font-600 border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          style={{ fontFamily: 'var(--font-display)' }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
          Preview
        </button>
        <button
          className="px-3.5 py-2 rounded-xl text-sm font-600 border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
          style={{ fontFamily: 'var(--font-display)' }}>
          Save Draft
        </button>
        <button onClick={onCallNext}
          className="px-4 py-2 rounded-xl text-sm font-600 text-white flex items-center gap-1.5 transition-opacity hover:opacity-90"
          style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M5 3l14 9-14 9V3z"/></svg>
          End & Call Next
        </button>
      </header>

      {/* ── Tab bar ── */}
      <div className="bg-white border-b border-gray-100 flex-shrink-0 px-6 flex items-center gap-0">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-5 py-3.5 text-sm font-600 border-b-2 transition-colors"
            style={{
              fontFamily: 'var(--font-display)',
              borderColor: activeTab === tab.key ? '#0B7070' : 'transparent',
              color: activeTab === tab.key ? '#0B7070' : '#9CA3AF',
            }}>
            <span style={{ color: activeTab === tab.key ? '#0B7070' : '#C4C4C4' }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ════ CLINICAL NOTES TAB ════ */}
        {activeTab === 'clinical' && (
        <div className="flex gap-5 px-6 py-6 items-start">

          {/* ── Left: editable clinical sections ── */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">

          {/* Vitals strip */}
          <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
            <p className="text-xs font-700 uppercase tracking-widest mb-3" style={{ color: '#0B7070', fontFamily: 'var(--font-display)' }}>
              Vitals <span className="font-400 normal-case tracking-normal text-gray-400">· from Nurse Exam</span>
            </p>
            <div className="grid grid-cols-7 gap-2">
              {[
                { label: 'BP', value: vitals.bp, unit: 'mmHg', warn: parseInt(vitals.bp) > 130 },
                { label: 'Pulse', value: vitals.pulse, unit: 'bpm', warn: false },
                { label: 'Temp', value: vitals.temp, unit: '°F', warn: parseFloat(vitals.temp) > 99 },
                { label: 'SpO₂', value: vitals.spo2, unit: '%', warn: parseFloat(vitals.spo2) < 95 },
                { label: 'Weight', value: vitals.weight, unit: 'kg', warn: false },
                { label: 'Height', value: vitals.height, unit: 'cm', warn: false },
                { label: 'BMI', value: bmi, unit: 'kg/m²', warn: false },
              ].map(v => (
                <div key={v.label} className="rounded-xl p-2.5 text-center" style={{ background: v.warn ? '#FFF7ED' : '#F9FAFB' }}>
                  <p className="text-xs text-gray-400 mb-1" style={{ fontFamily: 'var(--font-body)' }}>{v.label}</p>
                  <p className="font-700 text-base leading-none" style={{ fontFamily: 'var(--font-display)', color: v.warn ? '#D97706' : '#111827' }}>{v.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: v.warn ? '#F59E0B' : '#C4C4C4' }}>{v.unit}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Chief Complaint */}
          <SectionCard title="Chief Complaint & History" accent="#7C3AED">
            <div className="flex flex-col gap-3">
              <ChipField label="Presenting Complaint" value={complaint} onChange={setComplaint} rows={2}
                chips={['Pain', 'Swelling', 'Stiffness', 'Difficulty walking', 'Radiating pain', 'Numbness / tingling', 'Weakness', 'Locking of joint', 'Giving way', 'Deformity']}
                chipColor="#7C3AED" chipBg="#F5F3FF" />
              <ChipField label="History — duration, onset, aggravating & relieving factors" value={complaintHistory} onChange={setComplaintHistory} rows={3}
                placeholder="e.g. Pain started 3 months ago, gradual onset, worse on climbing stairs, relieved by rest…"
                chips={['Gradual onset', 'Sudden onset', 'Chronic', 'Acute', 'Worse on activity', 'Worse at rest', 'Morning stiffness', 'Relieved by rest', 'Night pain', 'H/o trauma', 'No H/o trauma']}
                chipColor="#7C3AED" chipBg="#F5F3FF" />
            </div>
          </SectionCard>

          {/* On Examination */}
          <SectionCard title="On Examination" accent="#0284C7">
            <div className="grid grid-cols-2 gap-4">
              <ChipField label="General Appearance" value={generalExam} onChange={setGeneralExam} rows={3}
                placeholder="Well-built, cooperative, no acute distress…"
                chips={['Well built', 'Moderately built', 'Obese', 'In pain', 'Cooperative', 'No acute distress', 'Antalgic gait', 'Normal gait']}
                chipColor="#0284C7" chipBg="#E0F2FE" />
              <ChipField label="Local Examination" value={localExam} onChange={setLocalExam} rows={3}
                placeholder="Tenderness, swelling, deformity…"
                chips={['Tenderness +', 'Swelling +', 'No swelling', 'Warmth +', 'Redness +', 'Deformity +', 'Muscle wasting', 'Scar present', 'No scar', 'Effusion +']}
                chipColor="#0284C7" chipBg="#E0F2FE" />
              <ChipField label="Range of Motion" value={rom} onChange={setRom} rows={3}
                placeholder="Flexion 0–90°, extension limited…"
                chips={['Full ROM', 'ROM restricted', 'Flexion limited', 'Extension limited', 'Rotation painful', 'Crepitus +', 'Pain at end range', 'Painless ROM']}
                chipColor="#0284C7" chipBg="#E0F2FE" />
              <ChipField label="Special Tests" value={specialTests} onChange={setSpecialTests} rows={3}
                placeholder="Lachman, McMurray, SLR, Spurling…"
                chips={['Lachman +ve', 'Lachman –ve', 'McMurray +ve', 'McMurray –ve', 'SLR +ve', 'SLR –ve', 'Spurling +ve', 'FABER +ve', 'Thomas test +ve', 'Trendelenburg +']}
                chipColor="#0284C7" chipBg="#E0F2FE" />
            </div>
          </SectionCard>

          {/* Assessment */}
          <SectionCard title="Assessment & Plan" accent="#059669">
            <ChipField label="" value={assessment} onChange={setAssessment} rows={3}
              placeholder="Clinical impression, management plan, rationale for investigations, physiotherapy referral…"
              chips={['Conservative management', 'Physiotherapy advised', 'Surgery advised', 'Injection therapy', 'MRI ordered', 'Reassurance given', 'Weight reduction advised', 'NSAID therapy', 'Review in 2 weeks', 'No further follow-up']}
              chipColor="#059669" chipBg="#D1FAE5" />
          </SectionCard>

          {/* Diagnosis */}
          <SectionCard title="Diagnosis / ICD-10" accent="#059669">
            <div className="relative">
              <input value={diagnosis} onChange={e => setDiagnosis(e.target.value)}
                onFocus={() => setShowICD(true)}
                onBlur={() => setTimeout(() => setShowICD(false), 150)}
                placeholder="Type or select diagnosis…"
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:border-emerald-400 focus:bg-white transition-colors"
                style={{ fontFamily: 'var(--font-body)' }} />
              {showICD && icdList.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                  {icdList.map(item => (
                    <button key={item.code}
                      onMouseDown={() => { setDiagnosis(item.label); setSelectedICD(item.code); setShowICD(false) }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0">
                      <p className="text-xs font-700 text-teal-700" style={{ fontFamily: 'var(--font-mono)' }}>{item.code}</p>
                      <p className="text-xs text-gray-700" style={{ fontFamily: 'var(--font-body)' }}>{item.label}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedICD && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs font-700 px-2 py-0.5 rounded" style={{ background: '#E6F4F4', color: '#0B7070', fontFamily: 'var(--font-mono)' }}>{selectedICD}</span>
                <span className="text-xs text-gray-500">{diagnosis}</span>
              </div>
            )}
          </SectionCard>

          <button onClick={() => setActiveTab('prescription')}
            className="w-full py-2.5 rounded-xl text-sm font-700 text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
            style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
            Save Notes & Continue to Prescription
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
          </div>

          {/* ── Right: reference panel ── */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-4">

            {/* Lab Reports */}
            <SectionCard title={`Lab Reports${hasLab ? ' · 2' : ' · none'}`} accent="#4F46E5">
              {hasLab ? (
                <div className="flex flex-col gap-2">
                  {[
                    { name: 'Knee X-Ray AP & Lateral', date: '08 Aug 2025', type: 'Radiology', finding: 'Grade IV OA changes. Joint space narrowing. No fracture.' },
                    { name: 'CBC + ESR', date: '07 Aug 2025', type: 'Pathology', finding: 'ESR 42 mm/hr↑. Hb 13.2. WBC normal.' },
                  ].map(r => (
                    <div key={r.name} className="p-3 rounded-xl" style={{ background: '#F5F3FF' }}>
                      <div className="flex items-start justify-between gap-1 mb-0.5">
                        <p className="text-xs font-700 text-indigo-800 leading-snug" style={{ fontFamily: 'var(--font-display)' }}>{r.name}</p>
                        <button className="text-xs font-600 text-indigo-400 hover:underline flex-shrink-0">View</button>
                      </div>
                      <p className="text-xs text-indigo-400 mb-1">{r.type} · {r.date}</p>
                      <p className="text-xs text-gray-600 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>{r.finding}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No reports uploaded</p>
              )}
            </SectionCard>

            {/* Past History */}
            <SectionCard title={`Past History · ${history.length} visit${history.length !== 1 ? 's' : ''}`} accent="#D97706">
              {history.length === 0 ? (
                <p className="text-xs text-gray-400 italic">First visit</p>
              ) : (
                <div className="flex flex-col gap-0">
                  {history.map((h, i) => (
                    <div key={i} className="flex gap-2.5">
                      <div className="flex flex-col items-center pt-0.5">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-700 flex-shrink-0"
                          style={{ background: '#FEF3C7', color: '#D97706', fontFamily: 'var(--font-display)', fontSize: 10 }}>
                          {history.length - i}
                        </div>
                        {i < history.length - 1 && <div className="w-px flex-1 my-1 bg-amber-100" />}
                      </div>
                      <div className="flex-1 pb-3">
                        <p className="text-xs font-700 text-amber-700 mb-0.5" style={{ fontFamily: 'var(--font-display)' }}>{h.date}</p>
                        <p className="text-xs text-gray-600 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>{h.summary}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
        )}

        {/* ════ PRESCRIPTION TAB ════ */}
        {activeTab === 'prescription' && (
        <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-5">

          {/* Rx header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-700 text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>Prescription</p>
              <p className="text-xs text-gray-400 mt-0.5">{patient.name} · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-600 border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors"
                style={{ fontFamily: 'var(--font-display)' }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm1-4h4v4H10v-4z"/></svg>
                Print Rx
              </button>
              <button onClick={() => setShowSend(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-600 border text-white transition-opacity hover:opacity-90"
                style={{ background: '#25D366', borderColor: '#25D366', fontFamily: 'var(--font-display)' }}>
                <WhatsAppIcon size={14} />
                Send Prescription
              </button>
            </div>
          </div>

          {/* Medications */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between" style={{ background: '#FAFAFA' }}>
              <p className="text-xs font-700 uppercase tracking-widest text-gray-500" style={{ fontFamily: 'var(--font-display)' }}>Medications</p>
              <span className="text-xs text-gray-400">{rx.length} item{rx.length !== 1 ? 's' : ''}</span>
            </div>
            {/* Col headers */}
            <div className="hidden md:grid px-5 py-2 text-xs font-600 uppercase tracking-wider text-gray-400 bg-gray-50/50 border-b border-gray-50"
              style={{ gridTemplateColumns: '2fr 110px 110px 1fr 32px', fontFamily: 'var(--font-display)' }}>
              <span>Drug</span><span>Dose</span><span>Duration</span><span>Instructions</span><span />
            </div>
            <div className="divide-y divide-gray-50">
              {rx.map((med, i) => (
                <div key={i} className="grid px-5 py-3.5 items-center gap-4 group"
                  style={{ gridTemplateColumns: '2fr 110px 110px 1fr 32px' }}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-700 flex-shrink-0"
                      style={{ background: '#E6F4F4', color: '#0B7070', fontFamily: 'var(--font-display)' }}>{i + 1}</span>
                    <p className="text-sm font-700 text-gray-800" style={{ fontFamily: 'var(--font-display)' }}>{med.drug}</p>
                  </div>
                  <span className="text-sm font-600" style={{ fontFamily: 'var(--font-mono)', color: '#374151' }}>{med.dose}</span>
                  <span className="text-sm text-gray-600" style={{ fontFamily: 'var(--font-body)' }}>{med.duration}</span>
                  <span className="text-xs text-gray-400 italic">{med.notes}</span>
                  <button onClick={() => setRx(prev => prev.filter((_, j) => j !== i))}
                    className="p-1 rounded-lg text-gray-200 hover:text-rose-400 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))}
            </div>
            {/* Add row */}
            <div className="px-5 py-4 border-t border-gray-50 bg-gray-50/40">
              <div className="relative mb-2">
                <input
                  value={newDrug.drug}
                  onChange={e => { setNewDrug(p => ({ ...p, drug: e.target.value })); setShowMedSuggestions(true) }}
                  onFocus={() => setShowMedSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowMedSuggestions(false), 150)}
                  placeholder="Search medicine name…"
                  className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-teal-400 transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }}
                />
                {showMedSuggestions && newDrug.drug.length >= 2 && (() => {
                  const matches = MEDICINE_DB.filter(m => m.name.toLowerCase().includes(newDrug.drug.toLowerCase()))
                  return matches.length > 0 ? (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden max-h-48 overflow-y-auto">
                      {matches.map(m => (
                        <button key={m.name} type="button"
                          onMouseDown={() => {
                            setNewDrug({ drug: m.name, dose: m.dose, duration: m.duration, notes: m.notes })
                            setShowMedSuggestions(false)
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-teal-50 transition-colors border-b border-gray-50 last:border-0">
                          <p className="text-sm font-600 text-gray-800" style={{ fontFamily: 'var(--font-display)' }}>{m.name}</p>
                          <p className="text-xs text-gray-400">{m.dose} · {m.duration} · {m.notes}</p>
                        </button>
                      ))}
                    </div>
                  ) : null
                })()}
              </div>
              <div className="grid gap-2.5" style={{ gridTemplateColumns: '110px 110px 1fr auto' }}>
                <input value={newDrug.dose} onChange={e => setNewDrug(p => ({ ...p, dose: e.target.value }))}
                  placeholder="1-0-1"
                  className="text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-teal-400 transition-colors"
                  style={{ fontFamily: 'var(--font-mono)' }} />
                <input value={newDrug.duration} onChange={e => setNewDrug(p => ({ ...p, duration: e.target.value }))}
                  placeholder="5 days"
                  className="text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-teal-400 transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }} />
                <input value={newDrug.notes} onChange={e => setNewDrug(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Instructions"
                  className="text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:border-teal-400 transition-colors"
                  style={{ fontFamily: 'var(--font-body)' }} />
                <button onClick={() => { if (newDrug.drug) { setRx(prev => [...prev, newDrug]); setNewDrug({ drug: '', dose: '', duration: '', notes: '' }) } }}
                  className="px-4 py-2 rounded-xl text-sm font-600 text-white transition-opacity hover:opacity-90"
                  style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
                  Add
                </button>
              </div>
            </div>
          </div>

          {/* Upload Handwritten Rx */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between" style={{ background: '#FAFAFA' }}>
              <p className="text-xs font-700 uppercase tracking-widest text-gray-500" style={{ fontFamily: 'var(--font-display)' }}>Handwritten Prescription</p>
              <span className="text-xs text-gray-400">Upload image to auto-fill</span>
            </div>
            <div className="p-4">
              {ocrState === 'idle' && (
                <label className="flex flex-col items-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-teal-300 hover:bg-teal-50/20 transition-colors">
                  <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth="1.5"><path strokeLinecap="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  <p className="text-sm text-gray-400" style={{ fontFamily: 'var(--font-body)' }}>Click to upload handwritten Rx image</p>
                  <p className="text-xs text-gray-300">JPG, PNG or PDF</p>
                  <input type="file" accept="image/*,.pdf" className="hidden" onChange={() => {
                    setOcrState('uploading')
                    setTimeout(() => {
                      setRx(prev => [...prev,
                        { drug: 'Tab. Diclofenac 50mg',   dose: '1-0-1', duration: '5 days',  notes: 'After food' },
                        { drug: 'Tab. Pantoprazole 40mg', dose: '1-0-0', duration: '5 days',  notes: 'Before food' },
                        { drug: 'Tab. Tizanidine 2mg',    dose: '0-0-1', duration: '3 days',  notes: 'At bedtime' },
                      ])
                      setOcrState('done')
                    }, 2200)
                  }} />
                </label>
              )}
              {ocrState === 'uploading' && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <svg className="animate-spin" width="24" height="24" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="#0B7070" strokeWidth="4"/><path className="opacity-75" fill="#0B7070" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  <p className="text-sm text-gray-500" style={{ fontFamily: 'var(--font-body)' }}>Reading prescription…</p>
                </div>
              )}
              {ocrState === 'done' && (
                <div className="flex items-center gap-3 py-3 px-4 rounded-xl" style={{ background: '#ECFDF5' }}>
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  <div className="flex-1">
                    <p className="text-sm font-600 text-emerald-800" style={{ fontFamily: 'var(--font-display)' }}>3 medicines extracted</p>
                    <p className="text-xs text-emerald-600">Added to prescription above. Review and edit as needed.</p>
                  </div>
                  <button onClick={() => setOcrState('idle')} className="text-xs text-emerald-600 hover:underline font-500" style={{ fontFamily: 'var(--font-display)' }}>Upload another</button>
                </div>
              )}
            </div>
          </div>

          {/* Advice */}
          <SectionCard title="Advice & Instructions" accent="#059669">
            <textarea rows={4} value={advice} onChange={e => setAdvice(e.target.value)}
              className="w-full text-sm text-gray-700 bg-transparent resize-none focus:outline-none leading-relaxed"
              style={{ fontFamily: 'var(--font-body)' }} />
          </SectionCard>

          {/* Investigations */}
          <SectionCard title="Investigations / Lab Orders" accent="#4F46E5">
            <div className="flex flex-wrap gap-2 mb-3">
              {['X-Ray', 'MRI', 'CT Scan', 'CBC', 'ESR / CRP', 'Uric Acid', 'HbA1c', 'Vitamin D', 'Bone Density', 'Thyroid Profile'].map(test => {
                const on = orderedTests.includes(test)
                return (
                  <button key={test}
                    onClick={() => setOrderedTests(prev => on ? prev.filter(t => t !== test) : [...prev, test])}
                    className="text-xs px-3 py-1.5 rounded-lg border font-600 transition-colors"
                    style={{
                      fontFamily: 'var(--font-display)',
                      background: on ? '#EEF2FF' : 'white',
                      color: on ? '#4F46E5' : '#6B7280',
                      borderColor: on ? '#A5B4FC' : '#E5E7EB',
                    }}>
                    {on ? '✓ ' : '+ '}{test}
                  </button>
                )
              })}
            </div>
            {orderedTests.length > 0 && (
              <p className="text-xs font-600" style={{ color: '#4F46E5', fontFamily: 'var(--font-display)' }}>
                {orderedTests.length} ordered: {orderedTests.join(' · ')}
              </p>
            )}
          </SectionCard>

          {/* Referral + Follow-up side by side */}
          <div className="grid grid-cols-2 gap-4">
            <SectionCard title="Referral" accent="#D97706">
              <select value={referral} onChange={e => setReferral(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:border-amber-400 text-gray-700 transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}>
                <option value="">No referral</option>
                <option>Dr. Himanshu Jain — Physiotherapy</option>
                <option>Radiology — X-ray / MRI</option>
                <option>Pathology — Blood work</option>
                <option>Dietitian</option>
              </select>
            </SectionCard>
            <SectionCard title="Follow-up" accent="#0284C7">
              <div className="flex flex-wrap gap-1.5">
                {['1 week', '2 weeks', '1 month', '3 months', 'As needed', 'No follow-up'].map(opt => (
                  <button key={opt} onClick={() => setFollowUp(opt)}
                    className="text-xs px-2.5 py-1.5 rounded-lg font-600 transition-colors border"
                    style={{
                      fontFamily: 'var(--font-display)',
                      background: followUp === opt ? '#0B7070' : 'white',
                      color: followUp === opt ? 'white' : '#6B7280',
                      borderColor: followUp === opt ? '#0B7070' : '#E5E7EB',
                    }}>
                    {opt}
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>

          <button
            className="w-full py-3 rounded-2xl text-sm font-700 text-white transition-opacity hover:opacity-90"
            style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
            Save Consultation Record
          </button>
        </div>
        )}
      </div>
      {showSend && <SendDialog patient={patient} onClose={() => setShowSend(false)} />}
      {showPreview && (
        <PrescriptionPreview
          patient={patient}
          prevCount={prevCount}
          vitals={vitals}
          bmi={bmi}
          complaint={complaint}
          complaintHistory={complaintHistory}
          generalExam={generalExam}
          localExam={localExam}
          rom={rom}
          specialTests={specialTests}
          assessment={assessment}
          diagnosis={diagnosis}
          selectedICD={selectedICD}
          rx={rx}
          advice={advice}
          orderedTests={orderedTests}
          referral={referral}
          followUp={followUp}
          onClose={() => setShowPreview(false)}
          onSend={() => { setShowPreview(false); setShowSend(true) }}
        />
      )}
    </div>
  )
}

// ── Doctor Dashboard ───────────────────────────────────────────────────────────
function DoctorDashboard({ onBack, patients, setPatients }: {
  onBack: () => void
  patients: Patient[]
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>
}) {
  const dr = 'Dr. Uday Pote'
  const [sessionStatus, setSessionStatus] = useState<DoctorStatus>('in-session')
  const [sessionStart] = useState(Date.now() - 49 * 60 * 1000)
  const [consultingId, setConsultingId] = useState<string | null>('P-2841')
  const [consultStart, setConsultStart] = useState(Date.now() - 12 * 60 * 1000)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [consultationPatient, setConsultationPatient] = useState<Patient | null>(null)

  const sessionElapsed = Math.floor((Date.now() - sessionStart) / 1000)
  const [sessionSecs, setSessionSecs] = useState(sessionElapsed)
  useEffect(() => {
    if (sessionStatus !== 'in-session') return
    const id = setInterval(() => setSessionSecs(Math.floor((Date.now() - sessionStart) / 1000)), 1000)
    return () => clearInterval(id)
  }, [sessionStatus, sessionStart])

  const [consultSecs, setConsultSecs] = useState(0)
  useEffect(() => {
    if (!consultingId) return
    const id = setInterval(() => setConsultSecs(Math.floor((Date.now() - consultStart) / 1000)), 1000)
    return () => clearInterval(id)
  }, [consultingId, consultStart])

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const drPatients = patients.filter(p => p.doctor === dr && p.status !== 'cancelled')
  const completed  = drPatients.filter(p => p.status === 'completed')
  const withDoc    = drPatients.filter(p => p.status === 'with-doctor')
  const arrived    = drPatients.filter(p => ['checked-in', 'nurse-exam'].includes(p.status))
  const notArrived = drPatients.filter(p => p.status === 'waiting')

  const avgConsultMins = 8

  const consultingPatient = consultingId ? patients.find(p => p.id === consultingId) : null

  const callNext = () => {
    const next = arrived[0] ?? notArrived[0]
    if (!next) return
    setConsultingId(next.id)
    setConsultStart(Date.now())
    setConsultSecs(0)
    setPatients(prev => prev.map(p => {
      if (p.id === next.id) return { ...p, status: 'with-doctor' }
      if (p.id === consultingId) return { ...p, status: 'completed' }
      return p
    }))
  }

  const sessionStatusCfg = {
    'not-arrived': { label: 'Not in Clinic', color: '#9CA3AF', bg: '#F9FAFB', dot: '#D1D5DB' },
    arrived:       { label: 'Arrived · Not Started', color: '#D97706', bg: '#FFFBEB', dot: '#FBBF24' },
    'in-session':  { label: 'Session Active', color: '#059669', bg: '#ECFDF5', dot: '#10B981' },
  }
  const ssc = sessionStatusCfg[sessionStatus]

  const advanceSession = () => {
    if (sessionStatus === 'not-arrived') setSessionStatus('arrived')
    else if (sessionStatus === 'arrived')    setSessionStatus('in-session')
    else setSessionStatus('not-arrived')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F4F7F9' }}>

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        <div className="px-6 py-3 flex items-center gap-4">
          <button onClick={onBack}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-teal-700 transition-colors font-500 flex-shrink-0"
            style={{ fontFamily: 'var(--font-display)' }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Front Desk
          </button>
          <div className="h-6 w-px bg-gray-100" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
              style={{ border: '1.5px solid #1D4ED822', background: '#EFF6FF' }}>
              <img src={CLINIC.logoUrl} alt={CLINIC.name} className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="font-700 text-gray-900 text-sm leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {CLINIC.name}
              </p>
              <p className="text-xs text-gray-400">{CLINIC.tagline}</p>
            </div>
          </div>
          <div className="flex-1" />

          {/* Session status toggle */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-600"
              style={{ background: ssc.bg, color: ssc.color, fontFamily: 'var(--font-display)', border: `1px solid ${ssc.dot}40` }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: ssc.dot }} />
              {ssc.label}
            </div>
            {sessionStatus === 'in-session' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-600 bg-gray-50 border border-gray-100"
                style={{ fontFamily: 'var(--font-mono)', color: '#374151' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                {fmtTime(sessionSecs)}
              </div>
            )}
            <button onClick={advanceSession}
              className="px-3 py-1.5 rounded-xl text-xs font-600 transition-colors"
              style={{
                fontFamily: 'var(--font-display)',
                background: sessionStatus === 'not-arrived' ? '#0B7070' : sessionStatus === 'arrived' ? '#059669' : '#FEF2F2',
                color: sessionStatus === 'in-session' ? '#DC2626' : 'white',
              }}>
              {sessionStatus === 'not-arrived' ? 'Mark Arrived' : sessionStatus === 'arrived' ? 'Start Session' : 'End Session'}
            </button>
          </div>

          {/* Doctor identity */}
          <div className="flex items-center gap-2.5 pl-3 border-l border-gray-100 ml-2">
            <Avatar name={dr} size={34} />
            <div>
              <p className="text-sm font-700 text-gray-800 leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{dr}</p>
              <p className="text-xs text-gray-400">Orthopedic Surgeon & Spine Specialist</p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-screen-xl mx-auto px-6 py-6 flex flex-col gap-5">

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Today's Patients", value: drPatients.length, sub: 'Scheduled', color: '#1E293B', icon: (
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
              )},
              { label: 'Completed', value: completed.length, sub: `${drPatients.length - completed.length - withDoc.length} remaining`, color: '#059669', icon: (
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              )},
              { label: 'Avg Consult', value: `${avgConsultMins}m`, sub: 'Per patient', color: '#7C3AED', icon: (
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
              )},
              { label: 'Upcoming Session', value: UPCOMING_SESSION.time, sub: `${UPCOMING_SESSION.count} scheduled`, color: '#0284C7', icon: (
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              )},
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-4 py-3.5 flex items-center gap-3">
                <span className="p-2 rounded-lg flex-shrink-0" style={{ background: s.color + '12', color: s.color }}>{s.icon}</span>
                <div>
                  <p className="text-xl font-700 leading-tight" style={{ fontFamily: 'var(--font-display)', color: s.color }}>{s.value}</p>
                  <p className="text-xs font-600 text-gray-700 leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{s.label}</p>
                  <p className="text-xs text-gray-400">{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-5 items-start">

            {/* Main patient list */}
            <div className="flex-1 flex flex-col gap-4 min-w-0">

              {/* Now consulting */}
              {consultingPatient && (
                <div className="bg-white rounded-2xl border-2 p-5 flex items-start gap-4 cursor-pointer hover:shadow-md transition-shadow"
                  style={{ borderColor: '#0B7070' }}
                  onClick={() => setConsultationPatient(consultingPatient)}>
                  <div className="flex-1 flex items-start gap-4">
                    <Avatar name={consultingPatient.name} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-700 px-2 py-0.5 rounded-full" style={{ background: '#E6F4F4', color: '#0B7070', fontFamily: 'var(--font-display)' }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                          NOW CONSULTING
                        </span>
                        {consultingPatient.isNew
                          ? <span className="text-xs font-700 px-1.5 py-0.5 rounded" style={{ background: '#E6F4F4', color: '#0B7070', fontFamily: 'var(--font-display)' }}>NEW</span>
                          : <span className="text-xs font-600 px-1.5 py-0.5 rounded bg-gray-100 text-gray-600" style={{ fontFamily: 'var(--font-display)' }}>
                              Follow-up #{PREV_APPTS[consultingPatient.id] ?? 1}
                            </span>
                        }
                        {LAB_REPORTS[consultingPatient.id] && (
                          <span className="text-xs font-600 px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: '#EEF2FF', color: '#4F46E5', fontFamily: 'var(--font-display)' }}>
                            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                            Lab Reports
                          </span>
                        )}
                      </div>
                      <p className="font-700 text-gray-900 text-base" style={{ fontFamily: 'var(--font-display)' }}>
                        {consultingPatient.name}
                      </p>
                      <p className="text-sm text-gray-500">{consultingPatient.age}y · {consultingPatient.gender === 'M' ? 'Male' : 'Female'} · {consultingPatient.reason}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ background: '#F0FDF4' }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      <span className="font-700 text-sm" style={{ fontFamily: 'var(--font-mono)', color: '#059669' }}>{fmtTime(consultSecs)}</span>
                    </div>
                    <button onClick={callNext}
                      className="px-4 py-2 rounded-xl text-sm font-600 text-white transition-opacity hover:opacity-90 flex items-center gap-2"
                      style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M5 3l14 9-14 9V3z"/></svg>
                      Call Next
                    </button>
                  </div>
                </div>
              )}

              {/* Patient groups */}
              {[
                { title: 'Arrived & Waiting', dot: '#FBBF24', bg: '#FFFBEB', list: arrived },
                { title: 'Not Yet Arrived', dot: '#D1D5DB', bg: '#F9FAFB', list: notArrived },
                { title: 'Completed', dot: '#10B981', bg: '#ECFDF5', list: completed },
              ].map(group => (
                <div key={group.title} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-gray-50 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.dot }} />
                    <h3 className="text-sm font-700 text-gray-800" style={{ fontFamily: 'var(--font-display)' }}>{group.title}</h3>
                    <span className="text-xs px-1.5 py-0.5 rounded-full font-600" style={{ background: group.bg, color: group.dot, fontFamily: 'var(--font-mono)' }}>
                      {group.list.length}
                    </span>
                  </div>

                  {/* Column headers */}
                  <div className="hidden md:grid px-5 py-2 text-xs font-600 text-gray-400 uppercase tracking-wider bg-gray-50/50 border-b border-gray-50"
                    style={{ gridTemplateColumns: '64px 1fr 90px 70px 90px 80px 32px', fontFamily: 'var(--font-display)' }}>
                    <span>Time</span>
                    <span>Patient</span>
                    <span>Visit</span>
                    <span>Prior</span>
                    <span>Status</span>
                    <span>Wait</span>
                    <span />
                  </div>

                  {group.list.length === 0 && (
                    <div className="px-5 py-4 text-xs text-gray-400 italic" style={{ fontFamily: 'var(--font-body)' }}>
                      No patients in this group
                    </div>
                  )}
                  {group.list.map((p, i) => {
                    const sc = STATUS_CFG[p.status]
                    const apptTime = p.arrivalTime
                    const [h, m] = apptTime.split(':').map(Number)
                    const apptMs = (h * 60 + m) * 60 * 1000
                    const nowMs = (new Date().getHours() * 60 + new Date().getMinutes()) * 60 * 1000
                    const waitMins = Math.max(0, Math.floor((nowMs - apptMs) / 60000))
                    const isLast = i === group.list.length - 1

                    return (
                      <div key={p.id}
                        className="cursor-pointer hover:bg-gray-50/80 transition-colors group"
                        style={{ borderBottom: isLast ? 'none' : '1px solid #F9FAFB' }}
                        onClick={() => setSelectedPatient(p)}>
                        <div className="hidden md:grid px-5 py-3.5 items-center"
                          style={{ gridTemplateColumns: '64px 1fr 90px 70px 90px 80px 32px' }}>

                          <span className="text-sm font-500" style={{ fontFamily: 'var(--font-mono)', color: '#6B7280' }}>{apptTime}</span>

                          <div className="min-w-0 pr-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-700 text-gray-900 text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                                {p.name}
                              </span>
                              <span className="text-xs text-gray-400">{p.age}y · {p.gender}</span>
                              {LAB_REPORTS[p.id] && (
                                <span title="Lab reports available" className="inline-flex items-center justify-center w-4 h-4 rounded" style={{ background: '#EEF2FF' }}>
                                  <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="#4F46E5" strokeWidth="2.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate">{p.reason}</p>
                          </div>

                          <div>
                            {p.isNew
                              ? <span className="text-xs font-700 px-1.5 py-0.5 rounded" style={{ background: '#E6F4F4', color: '#0B7070', fontFamily: 'var(--font-display)' }}>New</span>
                              : <span className="text-xs font-500 text-gray-500" style={{ fontFamily: 'var(--font-display)' }}>Follow-up</span>
                            }
                          </div>

                          <span className="text-xs text-gray-500" style={{ fontFamily: 'var(--font-mono)' }}>
                            {PREV_APPTS[p.id] ?? 0} visits
                          </span>

                          <span className="inline-flex items-center gap-1.5 text-xs font-600 px-2.5 py-1 rounded-full w-fit"
                            style={{ background: sc.bg, color: sc.text, fontFamily: 'var(--font-display)' }}>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
                            {sc.label}
                          </span>

                          <span className="text-xs font-500" style={{ fontFamily: 'var(--font-mono)', color: waitMins > 20 ? '#DC2626' : waitMins > 10 ? '#D97706' : '#6B7280' }}>
                            {p.status === 'completed' ? '—' : `${waitMins}m`}
                          </span>

                          <button className="p-1 rounded-lg text-gray-300 group-hover:text-teal-600 group-hover:bg-teal-50 transition-colors">
                            <ChevronRight />
                          </button>
                        </div>

                        {/* Mobile row */}
                        <div className="md:hidden px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="font-700 text-gray-900 text-sm" style={{ fontFamily: 'var(--font-display)' }}>{p.name}</span>
                              {LAB_REPORTS[p.id] && (
                                <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#4F46E5" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                              )}
                            </div>
                            <p className="text-xs text-gray-400">{apptTime} · {p.age}y · {p.reason}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-xs font-600 px-2 py-1 rounded-full flex-shrink-0"
                            style={{ background: sc.bg, color: sc.text, fontFamily: 'var(--font-display)', fontSize: 10 }}>
                            {sc.label}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            {/* Right side panel */}
            <div className="hidden lg:flex flex-col gap-4 w-64 flex-shrink-0">

              {/* Upcoming session */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-700 uppercase tracking-widest text-gray-400 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                  Upcoming Session
                </p>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-700 text-2xl text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>
                    {UPCOMING_SESSION.time}
                  </span>
                  <span className="text-xs font-600 px-2 py-1 rounded-lg" style={{ background: '#EFF6FF', color: '#2563EB', fontFamily: 'var(--font-display)' }}>
                    Evening
                  </span>
                </div>
                <p className="text-xs text-gray-500">{UPCOMING_SESSION.count} appointments scheduled</p>
                <div className="mt-3 pt-3 border-t border-gray-50 flex flex-col gap-1.5">
                  {['17:00 · Ramesh Sharma', '17:15 · Kavita Mehta', '17:30 · Ajay Verma'].map(item => (
                    <p key={item} className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-mono)' }}>{item}</p>
                  ))}
                  <p className="text-xs text-teal-600 font-600 mt-1 cursor-pointer hover:underline" style={{ fontFamily: 'var(--font-display)' }}>
                    +{UPCOMING_SESSION.count - 3} more
                  </p>
                </div>
              </div>

              {/* Summary of today */}
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs font-700 uppercase tracking-widest text-gray-400 mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                  Session Summary
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    { label: 'Completed', count: completed.length, color: '#059669' },
                    { label: 'In Progress', count: withDoc.length, color: '#0B7070' },
                    { label: 'Arrived / Waiting', count: arrived.length, color: '#D97706' },
                    { label: 'Not Yet Arrived', count: notArrived.length, color: '#9CA3AF' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.color }} />
                        <span className="text-xs text-gray-600" style={{ fontFamily: 'var(--font-body)' }}>{item.label}</span>
                      </div>
                      <span className="text-sm font-700" style={{ fontFamily: 'var(--font-display)', color: item.color }}>{item.count}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-50">
                  <div className="w-full rounded-full h-2 bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      background: '#059669',
                      width: `${Math.round(completed.length / drPatients.length * 100)}%`,
                    }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5" style={{ fontFamily: 'var(--font-body)' }}>
                    {Math.round(completed.length / drPatients.length * 100)}% session complete
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {selectedPatient && (
        <PatientProfilePage
          patient={selectedPatient}
          patients={patients}
          onClose={() => setSelectedPatient(null)}
          onCheckIn={() => {}}
        />
      )}

      {consultationPatient && (
        <ConsultationPage
          patient={consultationPatient}
          patients={patients}
          consultSecs={consultSecs}
          onClose={() => setConsultationPatient(null)}
          onCallNext={() => { callNext(); setConsultationPatient(null) }}
        />
      )}
    </div>
  )
}

// ── Patient Portal ─────────────────────────────────────────────────────────────

const AVAILABLE_SLOTS: Record<string, string[]> = {
  'Dr. Uday Pote': ['09:00','09:15','09:30','10:00','10:30','11:00','11:30','17:00','17:30','18:00','18:30','19:00'],
  'Dr. Himanshu Jain': ['09:00','09:30','10:00','10:30','11:00','11:30','12:00','17:00','17:30','18:00','18:30','19:00','19:30'],
}

const BOOKED_SLOTS: Record<string, string[]> = {
  'Dr. Uday Pote': ['09:15','10:00','11:30','17:30'],
  'Dr. Himanshu Jain': ['09:30','11:00','17:00','18:30'],
}

const DOCTOR_INFO = [
  {
    name: 'Dr. Uday Pote',
    specialty: 'Orthopedic Surgeon & Spine Specialist',
    quals: 'MS Ortho, DNB, FICS',
    exp: '18 years',
    photo: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop&auto=format',
    nextAvailable: 'Today',
    fee: '₹600',
  },
  {
    name: 'Dr. Himanshu Jain',
    specialty: 'Physiotherapist',
    quals: 'BPT, MPT (Musculoskeletal)',
    exp: '10 years',
    photo: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=200&h=200&fit=crop&auto=format',
    nextAvailable: 'Today',
    fee: '₹400',
  },
]

const SERVICES = [
  { title: 'Joint Replacement', desc: 'Knee and hip replacement with minimally invasive techniques', icon: '🦴' },
  { title: 'Spine Care', desc: 'Disc herniation, spondylosis, and spine surgery', icon: '🏥' },
  { title: 'Physiotherapy', desc: 'Post-surgical rehab, pain management, and sports recovery', icon: '💪' },
  { title: 'Sports Medicine', desc: 'ACL, rotator cuff, fractures, and sports injuries', icon: '🏃' },
]

function PatientPortal({ onBack, patients, setPatients }: {
  onBack: () => void
  patients: Patient[]
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>
}) {
  type Step = 'landing' | 'booking' | 'auth' | 'profile' | 'confirm' | 'checkin'
  const [step, setStep] = useState<Step>('landing')

  // booking state
  const today = new Date()
  const [selectedDate, setSelectedDate] = useState<Date>(today)
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [bookingStep, setBookingStep] = useState<1 | 2>(1)

  // auth state
  const [phone, setPhone] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState(['', '', '', ''])
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')

  // profile + reason
  const [foundPatient, setFoundPatient] = useState<Patient | null>(null)
  const [reason, setReason] = useState('')
  const [visitType, setVisitType] = useState<'new' | 'followup'>('new')

  // checkin
  const [checkedIn, setCheckedIn] = useState(false)

  const dateChips = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() + i)
    return d
  })

  const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
  const fmtDateLong = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

  const sendOtp = () => {
    if (phone.replace(/\s/g, '').length < 10) { setAuthError('Enter a valid 10-digit mobile number'); return }
    setAuthError('')
    setAuthLoading(true)
    setTimeout(() => { setAuthLoading(false); setOtpSent(true) }, 1200)
  }

  const verifyOtp = () => {
    const code = otp.join('')
    if (code.length < 4) { setAuthError('Enter the 4-digit OTP'); return }
    setAuthError('')
    setAuthLoading(true)
    setTimeout(() => {
      setAuthLoading(false)
      const cleanPhone = phone.replace(/\s/g, '')
      const found = patients.find(p => p.phone.replace(/\s/g, '') === cleanPhone)
      setFoundPatient(found ?? null)
      setVisitType(found ? 'followup' : 'new')
      setStep('profile')
    }, 1000)
  }

  const handleOtpInput = (val: string, idx: number) => {
    const next = [...otp]; next[idx] = val.slice(-1); setOtp(next)
  }

  const confirmAppointment = () => setStep('confirm')

  const doCheckIn = () => {
    if (foundPatient) {
      setPatients(prev => prev.map(p => p.id === foundPatient.id ? { ...p, status: 'checked-in' } : p))
    }
    setCheckedIn(true)
    setStep('checkin')
  }

  const queuePos = 3

  // ── Landing Page ──
  if (step === 'landing') return (
    <div className="min-h-screen flex flex-col" style={{ background: '#FFFFFF' }}>

      {/* Navbar */}
      <nav className="sticky top-0 z-30 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0" style={{ border: '1px solid #E5E7EB' }}>
            <img src={CLINIC.logoUrl} alt={CLINIC.name} className="w-full h-full object-contain" />
          </div>
          <div>
            <p className="font-700 text-gray-900 text-sm leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{CLINIC.name}</p>
            <p className="text-xs text-gray-400">{CLINIC.tagline}</p>
          </div>
        </div>
        <div className="flex-1" />
        <div className="hidden md:flex items-center gap-6">
          {['Doctors', 'Services', 'About', 'Contact'].map(l => (
            <a key={l} href="#" className="text-sm text-gray-600 hover:text-teal-700 font-500 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>{l}</a>
          ))}
        </div>
        <button onClick={() => setStep('booking')}
          className="px-4 py-2 rounded-xl text-sm font-700 text-white transition-opacity hover:opacity-90"
          style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
          Book Appointment
        </button>
        <button onClick={onBack} className="ml-2 text-xs text-gray-300 hover:text-gray-500 transition-colors" style={{ fontFamily: 'var(--font-body)' }}>
          ← Staff Login
        </button>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #071E26 0%, #0B7070 60%, #0D9488 100%)', minHeight: 520 }}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 70% 50%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative max-w-5xl mx-auto px-6 py-20 flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-600"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#7EEAEA', fontFamily: 'var(--font-display)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Accepting appointments today
            </div>
            <h1 className="text-4xl font-800 text-white leading-tight mb-4" style={{ fontFamily: 'var(--font-display)' }}>
              Expert Orthopedic &<br />Physiotherapy Care
            </h1>
            <p className="text-lg text-teal-100 mb-8 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
              Compassionate, evidence-based care for bone, joint, and muscle conditions. Same-day appointments available.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => setStep('booking')}
                className="px-6 py-3 rounded-xl text-sm font-700 text-white flex items-center gap-2 transition-all hover:scale-105"
                style={{ background: '#0D9488', fontFamily: 'var(--font-display)', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                Book Appointment
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
              <a href="tel:+919800011111"
                className="px-6 py-3 rounded-xl text-sm font-700 flex items-center gap-2 transition-colors hover:bg-white/20"
                style={{ border: '1.5px solid rgba(255,255,255,0.4)', color: 'white', fontFamily: 'var(--font-display)' }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.948V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                Call Us
              </a>
            </div>
            <div className="flex items-center gap-6 mt-10">
              {[{ n: '5000+', l: 'Patients treated' }, { n: '18 yrs', l: 'Experience' }, { n: '98%', l: 'Satisfaction' }].map(s => (
                <div key={s.l}>
                  <p className="text-2xl font-800 text-white" style={{ fontFamily: 'var(--font-display)' }}>{s.n}</p>
                  <p className="text-xs text-teal-200">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="hidden md:block w-72 flex-shrink-0">
            <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ border: '2px solid rgba(255,255,255,0.2)' }}>
              <img src="https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=600&h=500&fit=crop&auto=format" alt="Doctor consultation" className="w-full h-72 object-cover" />
              <div className="p-4" style={{ background: 'rgba(7,30,38,0.9)' }}>
                <p className="text-white text-sm font-600" style={{ fontFamily: 'var(--font-display)' }}>Next available: <span style={{ color: '#34D399' }}>Today · 09:30 AM</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-16 px-6 max-w-5xl mx-auto w-full">
        <div className="text-center mb-10">
          <p className="text-xs font-700 uppercase tracking-widest mb-2" style={{ color: '#0B7070', fontFamily: 'var(--font-display)' }}>What We Treat</p>
          <h2 className="text-2xl font-800 text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>Our Specialisations</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SERVICES.map(s => (
            <div key={s.title} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-teal-200 hover:shadow-md transition-all cursor-pointer group">
              <div className="text-3xl mb-3">{s.icon}</div>
              <p className="font-700 text-gray-900 text-sm mb-1.5 group-hover:text-teal-700 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>{s.title}</p>
              <p className="text-xs text-gray-400 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Doctors */}
      <section className="py-16 px-6" style={{ background: '#F4F7F9' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-700 uppercase tracking-widest mb-2" style={{ color: '#0B7070', fontFamily: 'var(--font-display)' }}>Our Team</p>
            <h2 className="text-2xl font-800 text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>Meet Your Doctors</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {DOCTOR_INFO.map(doc => (
              <div key={doc.name} className="bg-white rounded-2xl border border-gray-100 overflow-hidden flex gap-5 p-5 hover:shadow-md transition-shadow">
                <img src={doc.photo} alt={doc.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0 bg-gray-100" />
                <div className="flex-1 min-w-0">
                  <p className="font-700 text-gray-900 text-base" style={{ fontFamily: 'var(--font-display)' }}>{doc.name}</p>
                  <p className="text-sm text-teal-700 font-500 mb-1" style={{ fontFamily: 'var(--font-display)' }}>{doc.specialty}</p>
                  <p className="text-xs text-gray-400 mb-3">{doc.quals} · {doc.exp} exp</p>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2.5 py-1 rounded-full font-600" style={{ background: '#E6F4F4', color: '#0B7070', fontFamily: 'var(--font-display)' }}>
                      Available {doc.nextAvailable}
                    </span>
                    <span className="text-sm font-700 text-gray-700" style={{ fontFamily: 'var(--font-display)' }}>{doc.fee}</span>
                  </div>
                </div>
                <button onClick={() => { setSelectedDoctor(doc.name); setStep('booking') }}
                  className="self-center px-3 py-2 rounded-xl text-xs font-700 text-white flex-shrink-0 transition-opacity hover:opacity-90"
                  style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
                  Book
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 max-w-5xl mx-auto w-full">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-800 text-gray-900" style={{ fontFamily: 'var(--font-display)' }}>Book in 3 Simple Steps</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { n: '01', t: 'Choose Date & Doctor', d: 'Pick a convenient date, select your doctor, and choose an available time slot.' },
            { n: '02', t: 'Confirm with OTP', d: 'Login with your phone number. New patients get registered automatically.' },
            { n: '03', t: 'Walk in & Check In', d: 'Show your QR code at reception for a seamless, queue-free check-in.' },
          ].map(s => (
            <div key={s.n} className="flex gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center font-800 text-sm flex-shrink-0" style={{ background: '#E6F4F4', color: '#0B7070', fontFamily: 'var(--font-display)' }}>{s.n}</div>
              <div>
                <p className="font-700 text-gray-900 mb-1 text-sm" style={{ fontFamily: 'var(--font-display)' }}>{s.t}</p>
                <p className="text-xs text-gray-400 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg overflow-hidden"><img src={CLINIC.logoUrl} alt="" className="w-full h-full object-contain" /></div>
          <div>
            <p className="text-sm font-700 text-gray-800" style={{ fontFamily: 'var(--font-display)' }}>{CLINIC.name}</p>
            <p className="text-xs text-gray-400">© 2026 · All rights reserved</p>
          </div>
        </div>
        <p className="text-xs text-gray-300">Powered by <span className="text-gray-400 font-500">SwasthIQ</span></p>
      </footer>
    </div>
  )

  // ── Booking Page ──
  if (step === 'booking') {
    const slots = selectedDoctor ? AVAILABLE_SLOTS[selectedDoctor] ?? [] : []
    const booked = selectedDoctor ? BOOKED_SLOTS[selectedDoctor] ?? [] : []
    const morning = slots.filter(s => parseInt(s) < 13)
    const evening = slots.filter(s => parseInt(s) >= 13)

    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#F4F7F9' }}>
        {/* Header */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30 px-6 py-3 flex items-center gap-4">
          <button onClick={() => setStep('landing')} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-teal-700 font-500 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            Back
          </button>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden"><img src={CLINIC.logoUrl} alt="" className="w-full h-full object-contain" /></div>
            <p className="font-700 text-gray-900 text-sm" style={{ fontFamily: 'var(--font-display)' }}>{CLINIC.name}</p>
          </div>
          <div className="flex-1" />
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {[{ n: 1, l: 'Date & Doctor' }, { n: 2, l: 'Time Slot' }].map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                {i > 0 && <div className="w-6 h-px bg-gray-200" />}
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-700"
                    style={{ background: bookingStep >= s.n ? '#0B7070' : '#E5E7EB', color: bookingStep >= s.n ? 'white' : '#9CA3AF', fontFamily: 'var(--font-display)' }}>
                    {s.n}
                  </div>
                  <span className="text-xs font-500 hidden md:block" style={{ color: bookingStep >= s.n ? '#0B7070' : '#9CA3AF', fontFamily: 'var(--font-display)' }}>{s.l}</span>
                </div>
              </div>
            ))}
          </div>
        </header>

        <div className="flex-1 max-w-2xl mx-auto w-full px-6 py-8 flex flex-col gap-6">

          {bookingStep === 1 && (<>
            {/* Date selection */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="font-700 text-gray-900 mb-4 text-sm" style={{ fontFamily: 'var(--font-display)' }}>Select Appointment Date</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {dateChips.map(d => {
                  const sel = isSameDay(d, selectedDate)
                  const isToday = isSameDay(d, today)
                  return (
                    <button key={d.toDateString()} onClick={() => setSelectedDate(d)}
                      className="flex-shrink-0 flex flex-col items-center px-4 py-3 rounded-xl border font-600 transition-all"
                      style={{ background: sel ? '#0B7070' : 'white', borderColor: sel ? '#0B7070' : '#E5E7EB', color: sel ? 'white' : '#374151', fontFamily: 'var(--font-display)' }}>
                      <span className="text-xs opacity-70">{isToday ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
                      <span className="text-lg font-800">{d.getDate()}</span>
                      <span className="text-xs opacity-70">{d.toLocaleDateString('en-IN', { month: 'short' })}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Doctor selection */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="font-700 text-gray-900 mb-4 text-sm" style={{ fontFamily: 'var(--font-display)' }}>Choose Doctor</p>
              <div className="flex flex-col gap-3">
                {DOCTOR_INFO.map(doc => {
                  const sel = selectedDoctor === doc.name
                  const available = (AVAILABLE_SLOTS[doc.name] ?? []).length - (BOOKED_SLOTS[doc.name] ?? []).length
                  return (
                    <button key={doc.name} onClick={() => setSelectedDoctor(doc.name)}
                      className="flex items-center gap-4 p-4 rounded-xl border text-left transition-all"
                      style={{ borderColor: sel ? '#0B7070' : '#E5E7EB', background: sel ? '#F0FDFD' : 'white' }}>
                      <img src={doc.photo} alt={doc.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-gray-100" />
                      <div className="flex-1 min-w-0">
                        <p className="font-700 text-gray-900 text-sm" style={{ fontFamily: 'var(--font-display)' }}>{doc.name}</p>
                        <p className="text-xs text-gray-500 mb-1">{doc.specialty}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-600" style={{ color: '#059669' }}>{available} slots open today</span>
                          <span className="text-xs text-gray-400">· {doc.fee}</span>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors`}
                        style={{ borderColor: sel ? '#0B7070' : '#D1D5DB', background: sel ? '#0B7070' : 'white' }}>
                        {sel && <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <button
              onClick={() => { if (selectedDoctor) setBookingStep(2) }}
              disabled={!selectedDoctor}
              className="w-full py-3 rounded-xl font-700 text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
              Continue — Select Time Slot →
            </button>
          </>)}

          {bookingStep === 2 && (<>
            {/* Summary so far */}
            <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex items-center gap-3">
              {DOCTOR_INFO.find(d => d.name === selectedDoctor) && (
                <img src={DOCTOR_INFO.find(d => d.name === selectedDoctor)!.photo} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0 bg-gray-100" />
              )}
              <div>
                <p className="font-700 text-gray-900 text-sm" style={{ fontFamily: 'var(--font-display)' }}>{selectedDoctor}</p>
                <p className="text-xs text-gray-400">{fmtDateLong(selectedDate)}</p>
              </div>
              <button onClick={() => setBookingStep(1)} className="ml-auto text-xs text-teal-600 font-600 hover:underline" style={{ fontFamily: 'var(--font-display)' }}>Change</button>
            </div>

            {/* Time slots */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="font-700 text-gray-900 mb-4 text-sm" style={{ fontFamily: 'var(--font-display)' }}>Select Time Slot</p>

              {morning.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-600 text-gray-400 mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>Morning Session</p>
                  <div className="flex flex-wrap gap-2">
                    {morning.map(slot => {
                      const isBooked = booked.includes(slot)
                      const isSel = selectedSlot === slot
                      const [h, m] = slot.split(':').map(Number)
                      const label = `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
                      return (
                        <button key={slot} disabled={isBooked} onClick={() => setSelectedSlot(slot)}
                          className="px-4 py-2 rounded-xl text-sm font-600 border transition-all"
                          style={{
                            fontFamily: 'var(--font-display)',
                            background: isBooked ? '#F9FAFB' : isSel ? '#0B7070' : 'white',
                            borderColor: isBooked ? '#E5E7EB' : isSel ? '#0B7070' : '#E5E7EB',
                            color: isBooked ? '#D1D5DB' : isSel ? 'white' : '#374151',
                            cursor: isBooked ? 'not-allowed' : 'pointer',
                            textDecoration: isBooked ? 'line-through' : 'none',
                          }}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {evening.length > 0 && (
                <div>
                  <p className="text-xs font-600 text-gray-400 mb-2 uppercase tracking-wider" style={{ fontFamily: 'var(--font-display)' }}>Evening Session</p>
                  <div className="flex flex-wrap gap-2">
                    {evening.map(slot => {
                      const isBooked = booked.includes(slot)
                      const isSel = selectedSlot === slot
                      const [h, m] = slot.split(':').map(Number)
                      const label = `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')} PM`
                      return (
                        <button key={slot} disabled={isBooked} onClick={() => setSelectedSlot(slot)}
                          className="px-4 py-2 rounded-xl text-sm font-600 border transition-all"
                          style={{
                            fontFamily: 'var(--font-display)',
                            background: isBooked ? '#F9FAFB' : isSel ? '#0B7070' : 'white',
                            borderColor: isBooked ? '#E5E7EB' : isSel ? '#0B7070' : '#E5E7EB',
                            color: isBooked ? '#D1D5DB' : isSel ? 'white' : '#374151',
                            cursor: isBooked ? 'not-allowed' : 'pointer',
                            textDecoration: isBooked ? 'line-through' : 'none',
                          }}>
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => { if (selectedSlot) setStep('auth') }}
              disabled={!selectedSlot}
              className="w-full py-3 rounded-xl font-700 text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
              Continue — Login to Confirm →
            </button>
          </>)}
        </div>
      </div>
    )
  }

  // ── Auth Page ──
  if (step === 'auth') return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: '#F4F7F9' }}>
      <div className="bg-white rounded-2xl border border-gray-100 p-8 w-full max-w-sm shadow-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-xl overflow-hidden"><img src={CLINIC.logoUrl} alt="" className="w-full h-full object-contain" /></div>
          <p className="font-700 text-gray-900 text-sm" style={{ fontFamily: 'var(--font-display)' }}>{CLINIC.name}</p>
        </div>

        <h2 className="text-xl font-800 text-gray-900 mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          {otpSent ? 'Enter OTP' : 'Login / Register'}
        </h2>
        <p className="text-sm text-gray-400 mb-6" style={{ fontFamily: 'var(--font-body)' }}>
          {otpSent ? `We sent a 4-digit OTP to ${phone}` : 'Enter your mobile number to continue'}
        </p>

        {!otpSent ? (
          <>
            <div className="mb-4">
              <label className="text-xs font-600 text-gray-500 mb-1.5 block" style={{ fontFamily: 'var(--font-display)' }}>Mobile Number</label>
              <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden focus-within:border-teal-400 transition-colors">
                <span className="px-3 py-3 text-sm text-gray-500 border-r border-gray-200 bg-gray-50" style={{ fontFamily: 'var(--font-mono)' }}>+91</span>
                <input value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendOtp()}
                  placeholder="98765 43210" maxLength={11}
                  className="flex-1 px-3 py-3 text-sm focus:outline-none bg-white"
                  style={{ fontFamily: 'var(--font-mono)' }} />
              </div>
            </div>
            {authError && <p className="text-xs text-rose-500 mb-3">{authError}</p>}
            <button onClick={sendOtp} disabled={authLoading}
              className="w-full py-3 rounded-xl font-700 text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
              {authLoading ? <><svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Sending…</> : 'Send OTP'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-4">
              <label className="text-xs font-600 text-gray-500 mb-2 block" style={{ fontFamily: 'var(--font-display)' }}>4-Digit OTP</label>
              <div className="flex gap-3 justify-center">
                {otp.map((digit, i) => (
                  <input key={i} value={digit} onChange={e => handleOtpInput(e.target.value, i)}
                    maxLength={1} type="text" inputMode="numeric"
                    className="w-14 h-14 text-center text-xl font-700 rounded-xl border border-gray-200 focus:outline-none focus:border-teal-400 transition-colors"
                    style={{ fontFamily: 'var(--font-display)', color: '#0B7070' }}
                    onKeyDown={e => {
                      if (e.key === 'Backspace' && !digit && i > 0) (document.querySelectorAll('input[type=text]')[i - 1] as HTMLInputElement)?.focus()
                      if (e.key === 'Enter') verifyOtp()
                    }} />
                ))}
              </div>
              <p className="text-center mt-3">
                <button onClick={() => setOtpSent(false)} className="text-xs text-teal-600 hover:underline font-500" style={{ fontFamily: 'var(--font-display)' }}>Change number</button>
              </p>
            </div>
            {authError && <p className="text-xs text-rose-500 mb-3 text-center">{authError}</p>}
            <button onClick={verifyOtp} disabled={authLoading}
              className="w-full py-3 rounded-xl font-700 text-white text-sm transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
              {authLoading ? <><svg className="animate-spin" width="14" height="14" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/><path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Verifying…</> : 'Verify & Continue'}
            </button>
          </>
        )}

        <button onClick={() => setStep('booking')} className="w-full mt-4 text-xs text-gray-400 hover:text-gray-600 transition-colors" style={{ fontFamily: 'var(--font-body)' }}>
          ← Back to slot selection
        </button>
      </div>
    </div>
  )

  // ── Profile + Reason Page ──
  if (step === 'profile') return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: '#F4F7F9' }}>
      <div className="bg-white rounded-2xl border border-gray-100 p-8 w-full max-w-md shadow-sm">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-xl overflow-hidden"><img src={CLINIC.logoUrl} alt="" className="w-full h-full object-contain" /></div>
          <p className="font-700 text-gray-900 text-sm" style={{ fontFamily: 'var(--font-display)' }}>{CLINIC.name}</p>
        </div>

        {foundPatient ? (
          <>
            <div className="flex items-center gap-3 p-4 rounded-xl mb-5" style={{ background: '#E6F4F4' }}>
              <Avatar name={foundPatient.name} size={44} />
              <div>
                <p className="font-700 text-gray-900 text-base" style={{ fontFamily: 'var(--font-display)' }}>Welcome back, {foundPatient.name.split(' ')[0]}!</p>
                <p className="text-xs text-gray-500">{foundPatient.age}y · {foundPatient.gender === 'M' ? 'Male' : 'Female'} · {foundPatient.id}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="mb-5">
            <p className="font-700 text-gray-900 text-base mb-1" style={{ fontFamily: 'var(--font-display)' }}>New Patient</p>
            <p className="text-xs text-gray-400">Your profile will be created after confirmation.</p>
          </div>
        )}

        {/* Appointment summary */}
        <div className="rounded-xl border border-gray-100 p-4 mb-5 bg-gray-50">
          <p className="text-xs font-700 uppercase tracking-wider text-gray-400 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Appointment Summary</p>
          <div className="flex flex-col gap-1.5">
            {[
              { l: 'Doctor', v: selectedDoctor ?? '' },
              { l: 'Date', v: fmtDateLong(selectedDate) },
              { l: 'Time', v: (() => { const [h, m] = (selectedSlot ?? '9:00').split(':').map(Number); return `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` })() },
            ].map(f => (
              <div key={f.l} className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{f.l}</span>
                <span className="text-xs font-600 text-gray-700" style={{ fontFamily: 'var(--font-display)' }}>{f.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Visit type */}
        <div className="mb-4">
          <p className="text-xs font-600 text-gray-500 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Visit Type</p>
          <div className="flex gap-2">
            {['new', 'followup'].map(t => (
              <button key={t} onClick={() => setVisitType(t as 'new' | 'followup')}
                className="flex-1 py-2 rounded-xl text-xs font-600 border transition-colors"
                style={{
                  fontFamily: 'var(--font-display)',
                  background: visitType === t ? '#0B7070' : 'white',
                  color: visitType === t ? 'white' : '#6B7280',
                  borderColor: visitType === t ? '#0B7070' : '#E5E7EB',
                }}>
                {t === 'new' ? 'New Consultation' : 'Follow-up'}
              </button>
            ))}
          </div>
        </div>

        {/* Reason */}
        <div className="mb-5">
          <p className="text-xs font-600 text-gray-500 mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>Reason for Visit</p>
          <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)}
            placeholder="Brief description of your symptoms or concern…"
            className="w-full text-sm px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:border-teal-400 focus:bg-white resize-none placeholder-gray-300 leading-relaxed transition-colors"
            style={{ fontFamily: 'var(--font-body)' }} />
        </div>

        <button onClick={confirmAppointment}
          className="w-full py-3 rounded-xl font-700 text-white text-sm transition-opacity hover:opacity-90"
          style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
          Confirm Appointment →
        </button>
      </div>
    </div>
  )

  // ── Confirmation Page ──
  if (step === 'confirm') {
    const slotFmt = (() => { const [h, m] = (selectedSlot ?? '9:00').split(':').map(Number); return `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` })()
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: '#F4F7F9' }}>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 w-full max-w-md shadow-sm text-center">

          {/* Tick */}
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: '#ECFDF5' }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#059669" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          </div>
          <h2 className="text-xl font-800 text-gray-900 mb-1" style={{ fontFamily: 'var(--font-display)' }}>Appointment Confirmed!</h2>
          <p className="text-sm text-gray-400 mb-6" style={{ fontFamily: 'var(--font-body)' }}>
            {foundPatient ? foundPatient.name : 'Your appointment'} is booked at {CLINIC.name}
          </p>

          {/* Booking card */}
          <div className="rounded-2xl overflow-hidden border border-gray-100 mb-5 text-left">
            <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg, #0B7070, #0D9488)' }}>
              <p className="font-700 text-white text-sm" style={{ fontFamily: 'var(--font-display)' }}>{CLINIC.name}</p>
              <p className="text-xs text-teal-200">{CLINIC.tagline}</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 gap-3 bg-white">
              {[
                { l: 'Doctor', v: selectedDoctor ?? '' },
                { l: 'Date', v: fmtDate(selectedDate) },
                { l: 'Time', v: slotFmt },
                { l: 'Token', v: 'A12' },
                { l: 'Visit Type', v: visitType === 'new' ? 'New Consultation' : 'Follow-up' },
                ...(reason ? [{ l: 'Reason', v: reason }] : []),
              ].map(f => (
                <div key={f.l}>
                  <p className="text-xs text-gray-400 mb-0.5">{f.l}</p>
                  <p className="text-sm font-600 text-gray-800" style={{ fontFamily: 'var(--font-display)' }}>{f.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5">
            <button onClick={doCheckIn}
              className="w-full py-3 rounded-xl font-700 text-white text-sm transition-opacity hover:opacity-90"
              style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
              Check In Now →
            </button>
            <button className="w-full py-2.5 rounded-xl font-600 text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              style={{ fontFamily: 'var(--font-display)' }}>
              <WhatsAppIcon size={14} />
              Share on WhatsApp
            </button>
            <button onClick={() => setStep('landing')} className="text-xs text-gray-400 hover:text-gray-600 transition-colors mt-1" style={{ fontFamily: 'var(--font-body)' }}>
              Back to home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Check-in Page ──
  if (step === 'checkin') {
    const slotFmt = (() => { const [h, m] = (selectedSlot ?? '9:00').split(':').map(Number); return `${h > 12 ? h - 12 : h}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}` })()
    const qrValue = foundPatient ? `HARMONY-${foundPatient.id}-CHECKIN` : `HARMONY-NEW-${Date.now()}`
    const tips = [
      "Carry any previous X-rays or MRI reports for the doctor's review.",
      'Please inform the reception if you need assistance or a wheelchair.',
      "Keep your mobile handy — we'll notify you when it's your turn.",
      'Average wait time today: approximately 15–20 minutes.',
    ]
    const [tipIdx, setTipIdx] = useState(0)
    useEffect(() => {
      const id = setInterval(() => setTipIdx(i => (i + 1) % tips.length), 4000)
      return () => clearInterval(id)
    }, [])

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: '#F4F7F9' }}>
        <div className="bg-white rounded-2xl border border-gray-100 p-8 w-full max-w-sm shadow-sm text-center">

          <div className="flex items-center gap-2.5 mb-6 justify-center">
            <div className="w-8 h-8 rounded-xl overflow-hidden"><img src={CLINIC.logoUrl} alt="" className="w-full h-full object-contain" /></div>
            <p className="font-700 text-gray-900 text-sm" style={{ fontFamily: 'var(--font-display)' }}>{CLINIC.name}</p>
          </div>

          {checkedIn ? (
            <>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-700 mb-4" style={{ background: '#ECFDF5', color: '#059669', fontFamily: 'var(--font-display)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Checked In
              </div>
              <p className="text-lg font-800 text-gray-900 mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                {foundPatient ? foundPatient.name.split(' ')[0] : 'You'}, you're in the queue!
              </p>
              <p className="text-sm text-gray-400 mb-5">{selectedDoctor} · {slotFmt}</p>

              {/* QR code */}
              <div className="flex justify-center mb-5">
                <div className="p-4 rounded-2xl border-2 border-dashed" style={{ borderColor: '#0B7070' }}>
                  <QRCodeSVG value={qrValue} size={160} />
                </div>
              </div>

              {/* Queue position */}
              <div className="flex items-center justify-center gap-4 mb-5 py-4 rounded-xl" style={{ background: '#F0FDFD' }}>
                <div>
                  <p className="text-3xl font-800" style={{ fontFamily: 'var(--font-display)', color: '#0B7070' }}>{queuePos}</p>
                  <p className="text-xs text-gray-400">Queue position</p>
                </div>
                <div className="w-px h-10 bg-teal-100" />
                <div>
                  <p className="text-3xl font-800" style={{ fontFamily: 'var(--font-display)', color: '#0B7070' }}>~{queuePos * 8}m</p>
                  <p className="text-xs text-gray-400">Est. wait time</p>
                </div>
              </div>

              {/* Tips carousel */}
              <div className="px-4 py-3 rounded-xl text-xs text-gray-500 leading-relaxed min-h-12 transition-all" style={{ background: '#F9FAFB', fontFamily: 'var(--font-body)' }}>
                💡 {tips[tipIdx]}
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-800 text-gray-900 mb-2" style={{ fontFamily: 'var(--font-display)' }}>Ready to Check In?</h2>
              <p className="text-sm text-gray-400 mb-6">Show the QR code below at the reception desk or scan it yourself.</p>
              <div className="flex justify-center mb-6">
                <div className="p-4 rounded-2xl border-2 border-dashed" style={{ borderColor: '#0B7070' }}>
                  <QRCodeSVG value={qrValue} size={160} />
                </div>
              </div>
              <button onClick={doCheckIn}
                className="w-full py-3 rounded-xl font-700 text-white text-sm transition-opacity hover:opacity-90"
                style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
                Confirm Check-In
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return null
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<'frontdesk' | 'doctor' | 'patient'>('frontdesk')
  const [search, setSearch]         = useState('')
  const [showRegister, setShowReg]    = useState(false)
  const [registering, setRegistering] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [showAppt, setShowAppt]     = useState(false)
  const [patients, setPatients]     = useState(INITIAL_PATIENTS)
  const [activeFilter, setFilter]   = useState<Status | 'all'>('all')
  const [showWa, setShowWa]         = useState(false)
  const [waMessages, setWaMessages] = useState(WA_MESSAGES)
  const [doctors, setDoctors]       = useState(INITIAL_DOCTORS)

  const unreadWa = waMessages.filter(m => !m.read).length
  const markWaRead = (id: string) =>
    setWaMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m))

  const handleCheckIn = (patientId: string) =>
    setPatients(prev => prev.map(p => p.id === patientId && p.status === 'waiting' ? { ...p, status: 'checked-in' } : p))

  const advanceDoctorStatus = (name: string) => {
    const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
    setDoctors(prev => prev.map(d => {
      if (d.name !== name) return d
      if (d.status === 'not-arrived') return { ...d, status: 'arrived',    arrivedAt: now }
      if (d.status === 'arrived')     return { ...d, status: 'in-session' }
      return { ...d, status: 'arrived' }
    }))
  }

  const sessionPatients = patients.filter(p => p.status !== 'cancelled')
  const waiting    = patients.filter(p => p.status === 'waiting').length
  const checkedIn  = patients.filter(p => p.status === 'checked-in').length
  const nurseExam  = patients.filter(p => p.status === 'nurse-exam').length
  const withDoctor = patients.filter(p => p.status === 'with-doctor').length
  const completed  = patients.filter(p => p.status === 'completed').length

  const filtered = patients.filter(p => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.token.toLowerCase().includes(search.toLowerCase()) ||
      p.doctor.toLowerCase().includes(search.toLowerCase())
    const matchFilter = activeFilter === 'all' || p.status === activeFilter
    return matchSearch && matchFilter
  })

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const stats = [
    { label: "Today's Session", value: sessionPatients.length, sub: 'Total this session', color: '#1E293B', icon: <TodayIcon /> },
    { label: 'Waiting',         value: waiting,                sub: `${checkedIn} checked in`, color: '#D97706', icon: <WaitIcon  /> },
    { label: 'Nurse Exam',      value: nurseExam,              sub: 'Vitals in progress', color: '#C026D3', icon: <NurseIcon /> },
    { label: 'With Doctor',     value: withDoctor,             sub: 'In consultation',    color: '#2563EB', icon: <DocIcon   /> },
    { label: 'Completed',       value: completed,              sub: 'Seen & discharged',  color: '#059669', icon: <DoneIcon  /> },
  ]

  const filterTabs: { key: Status | 'all'; label: string }[] = [
    { key: 'all',         label: 'All' },
    { key: 'waiting',     label: 'Waiting' },
    { key: 'checked-in',  label: 'Checked In' },
    { key: 'nurse-exam',  label: 'Nurse Exam' },
    { key: 'with-doctor', label: 'With Doctor' },
    { key: 'completed',   label: 'Completed' },
  ]

  if (registering) {
    return <RegisterPage onClose={() => setRegistering(false)} onComplete={() => setRegistering(false)} />
  }

  if (view === 'doctor') {
    return <DoctorDashboard onBack={() => setView('frontdesk')} patients={patients} setPatients={setPatients} />
  }

  if (view === 'patient') {
    return <PatientPortal onBack={() => setView('frontdesk')} patients={patients} setPatients={setPatients} />
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#F4F7F9' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-30">
        {/* Top strip */}
        <div className="px-6 py-3 flex items-center gap-4">

          {/* Clinic identity */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-white flex items-center justify-center"
              style={{ border: `1.5px solid ${CLINIC.logoColor}22` }}>
              <img src={CLINIC.logoUrl} alt={CLINIC.name} className="w-full h-full object-contain" />
            </div>
            <div className="hidden sm:block">
              <p className="font-700 text-gray-900 text-sm leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {CLINIC.name}
              </p>
              <p className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-body)' }}>
                {CLINIC.tagline}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-gray-100 hidden sm:block" />

          {/* Search — grows to fill space */}
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <SearchIcon />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search patient name, ID, token, doctor…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:border-teal-500 focus:bg-white transition-colors placeholder-gray-400"
              style={{ fontFamily: 'var(--font-body)' }}
            />
          </div>

          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowAppt(true)}
              className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
              style={{ fontFamily: 'var(--font-display)' }}>
              <CalPlusIcon />
              New Appointment
            </button>

            <button
              onClick={() => setRegistering(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-600 text-white transition-opacity hover:opacity-90"
              style={{ background: '#0B7070', fontFamily: 'var(--font-display)' }}>
              <UserPlusIcon />
              <span className="hidden sm:inline">Register Patient</span>
              <span className="sm:hidden">Register</span>
            </button>

            {/* Doctor view */}
            <button
              onClick={() => setView('doctor')}
              className="hidden sm:flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-600 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
              style={{ fontFamily: 'var(--font-display)' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Doctor View
            </button>

            {/* Patient portal */}
            <button
              onClick={() => setView('patient')}
              className="hidden sm:flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-600 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
              style={{ fontFamily: 'var(--font-display)' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
              Patient Portal
            </button>

            {/* WhatsApp messages */}
            <button
              onClick={() => setShowWa(v => !v)}
              className="relative p-2.5 rounded-xl hover:bg-green-50 transition-colors border border-gray-100"
              style={{ color: '#25D366' }}
              title="Patient WhatsApp messages"
            >
              <WhatsAppIcon size={18} />
              {unreadWa > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-white font-700 border-2 border-white"
                  style={{ background: '#25D366', fontSize: 10, fontFamily: 'var(--font-display)', padding: '0 4px' }}
                >
                  {unreadWa}
                </span>
              )}
            </button>

            {/* Notifications */}
            <button className="relative p-2.5 rounded-xl hover:bg-gray-100 transition-colors text-gray-500 border border-gray-100">
              <BellIcon />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 border-2 border-white" />
            </button>

            {/* Staff avatar */}
            <div className="flex items-center gap-2 pl-1">
              <Avatar name="Sneha Kulkarni" size={34} />
              <div className="hidden md:block">
                <p className="text-xs font-600 text-gray-700 leading-tight" style={{ fontFamily: 'var(--font-display)' }}>Sneha Kulkarni.</p>
                <p className="text-xs text-gray-400">Front Desk</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sub-strip: date + Powered by */}
        <div className="px-6 py-2 border-t border-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-body)' }}>{today}</p>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded flex items-center justify-center text-white font-700"
              style={{ background: '#0B7070', fontSize: 8, fontFamily: 'var(--font-display)' }}>
              S
            </div>
            <p className="text-xs" style={{ color: '#9CA3AF', fontFamily: 'var(--font-body)' }}>
              Powered by <span className="font-500 text-gray-500">SwasthIQ</span>
            </p>
          </div>
        </div>
      </header>

      {/* ── Main scrollable area ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-screen-xl mx-auto px-6 py-6 flex flex-col gap-6">

          {/* ── Stats ──────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-5 gap-3">
            {stats.map(s => (
              <StatCard key={s.label} label={s.label} value={s.value} sub={s.sub} accentColor={s.color} icon={s.icon} />
            ))}
          </div>

          {/* ── Doctor Arrival Panel ───────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-100 px-5 py-2.5 flex items-center gap-6">
            <p className="text-xs font-700 uppercase tracking-widest text-gray-400 flex-shrink-0 w-24" style={{ fontFamily: 'var(--font-display)' }}>
              Doctors
            </p>
            <div className="flex items-center gap-3 flex-1">
              {doctors.map(doc => {
                const dc = DOCTOR_STATUS_CFG[doc.status]
                return (
                  <div key={doc.name}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl border flex-shrink-0"
                    style={{ background: dc.bg, borderColor: dc.dot + '40' }}>
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: dc.dot }} />
                    <div>
                      <p className="text-xs font-700 text-gray-800 leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                        {doc.name}
                      </p>
                      <p className="text-xs leading-tight" style={{ color: dc.text, fontFamily: 'var(--font-body)' }}>
                        {dc.label}{doc.arrivedAt ? ` · ${doc.arrivedAt}` : ''}
                      </p>
                    </div>
                    <button
                      onClick={e => { e.stopPropagation(); advanceDoctorStatus(doc.name) }}
                      className="text-xs font-600 px-2.5 py-1 rounded-lg transition-colors hover:opacity-80 ml-1 flex-shrink-0"
                      style={{
                        fontFamily: 'var(--font-display)',
                        background: doc.status === 'not-arrived' ? '#F3F4F6' : doc.status === 'arrived' ? '#059669' : '#E5E7EB',
                        color: doc.status === 'arrived' ? 'white' : '#374151',
                      }}>
                      {dc.action}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Queue + Schedule ────────────────────────────────────────────── */}
          <div className="flex gap-5 items-start">

            {/* Patient Queue — main panel */}
            <div className="flex-1 bg-white rounded-2xl border border-gray-100 overflow-hidden min-w-0">

              {/* Queue header */}
              <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2.5 mr-auto">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <h2 className="font-700 text-gray-800 text-sm" style={{ fontFamily: 'var(--font-display)' }}>
                    Current Queue
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-500" style={{ fontFamily: 'var(--font-mono)' }}>
                    {filtered.length}
                  </span>
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-1 bg-gray-50 rounded-xl p-1 flex-wrap">
                  {filterTabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setFilter(tab.key)}
                      className="px-3 py-1.5 rounded-lg text-xs font-600 transition-colors"
                      style={{
                        fontFamily: 'var(--font-display)',
                        background: activeFilter === tab.key ? 'white' : 'transparent',
                        color: activeFilter === tab.key ? '#0B7070' : '#6B7280',
                        boxShadow: activeFilter === tab.key ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      }}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Column headers — desktop */}
              <div className="hidden md:grid px-5 py-2.5 text-xs font-600 text-gray-400 uppercase tracking-wider bg-gray-50/50 border-b border-gray-50"
                style={{ gridTemplateColumns: '52px 1fr 140px 72px 116px 40px', fontFamily: 'var(--font-display)' }}>
                <span>Token</span>
                <span>Patient</span>
                <span>Doctor</span>
                <span>Arrival</span>
                <span>Status</span>
                <span />
              </div>

              {/* Queue rows */}
              <div>
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <p className="text-sm font-500" style={{ fontFamily: 'var(--font-display)' }}>
                      {search ? `No patients matching "${search}"` : 'No patients in this filter'}
                    </p>
                  </div>
                ) : filtered.map((p, i) => {
                  const sc = STATUS_CFG[p.status]
                  const isLast = i === filtered.length - 1

                  return (
                    <div key={p.id} className="group cursor-pointer hover:bg-gray-50/70 transition-colors"
                      style={{ borderBottom: isLast ? 'none' : '1px solid #F9FAFB' }}
                      onClick={() => setSelectedPatient(p)}>

                      {/* ── Desktop row ── */}
                      <div className="hidden md:grid px-5 py-3.5 items-center"
                        style={{ gridTemplateColumns: '52px 1fr 140px 72px 116px 40px' }}>

                        <span className="text-sm font-500" style={{ fontFamily: 'var(--font-mono)', color: '#0B7070' }}>
                          {p.token}
                        </span>

                        <div className="min-w-0 pr-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-600 text-gray-800" style={{ fontFamily: 'var(--font-display)' }}>
                              {p.name}
                            </span>
                            {p.isNew && (
                              <span className="text-xs px-1.5 py-0.5 rounded font-600 flex-shrink-0" style={{ background: '#E6F4F4', color: '#0B7070', fontFamily: 'var(--font-display)' }}>NEW</span>
                            )}
                            {p.priority === 'urgent' && (
                              <span className="text-xs px-1.5 py-0.5 rounded font-600 bg-rose-50 text-rose-600 flex-shrink-0" style={{ fontFamily: 'var(--font-display)' }}>URGENT</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400">{p.age}y · {p.gender} · {p.reason}</p>
                        </div>

                        <span className="text-xs text-gray-500 truncate" style={{ fontFamily: 'var(--font-body)' }}>
                          {p.doctor}
                        </span>

                        <span className="text-xs" style={{ fontFamily: 'var(--font-mono)', color: '#9CA3AF' }}>
                          {p.arrivalTime}
                        </span>

                        <span className="inline-flex items-center gap-1.5 text-xs font-600 px-2.5 py-1 rounded-full w-fit"
                          style={{ background: sc.bg, color: sc.text, fontFamily: 'var(--font-display)' }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sc.dot }} />
                          {sc.label}
                        </span>

                        <div className="flex justify-end">
                          <button className="p-1.5 rounded-lg text-gray-300 group-hover:text-teal-600 group-hover:bg-teal-50 transition-colors">
                            <ChevronRight />
                          </button>
                        </div>
                      </div>

                      {/* ── Mobile row ── */}
                      <div className="md:hidden px-4 py-3 flex items-center gap-3">
                        <span className="text-xs font-600 w-8 flex-shrink-0" style={{ fontFamily: 'var(--font-mono)', color: '#0B7070' }}>
                          {p.token}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-600 text-gray-800 truncate" style={{ fontFamily: 'var(--font-display)' }}>
                              {p.name}
                            </span>
                            {p.priority === 'urgent' && (
                              <span className="text-xs px-1 py-0.5 rounded font-600 bg-rose-50 text-rose-600 flex-shrink-0" style={{ fontFamily: 'var(--font-display)', fontSize: 10 }}>!</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate">{p.age}y · {p.doctor.replace('Dr. ', '')} · {p.arrivalTime}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-600 px-2 py-1 rounded-full flex-shrink-0"
                          style={{ background: sc.bg, color: sc.text, fontFamily: 'var(--font-display)', fontSize: 10 }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
                          {sc.label}
                        </span>
                        <button className="p-1 text-gray-300 group-hover:text-teal-600 flex-shrink-0">
                          <ChevronRight />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Today's schedule — side panel */}
            <div className="hidden lg:flex w-60 flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden flex-shrink-0">
              <div className="px-4 py-4 border-b border-gray-100">
                <h2 className="font-700 text-gray-800 text-sm" style={{ fontFamily: 'var(--font-display)' }}>Today's Schedule</h2>
                <p className="text-xs text-gray-400 mt-0.5">{APPOINTMENTS.length} appointments</p>
              </div>
              <div className="overflow-y-auto px-3 py-3 flex flex-col gap-2" style={{ maxHeight: 480 }}>
                {APPOINTMENTS.map(appt => {
                  const asc = APPT_CFG[appt.status]
                  const isNow = appt.status === 'in-progress'
                  return (
                    <div key={appt.id}
                      className="rounded-xl p-3 flex flex-col gap-1 cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ border: isNow ? '1.5px solid #0B7070' : '1px solid #F3F4F6', background: isNow ? '#E6F4F4' : 'white' }}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-500" style={{ fontFamily: 'var(--font-mono)', color: isNow ? '#0B7070' : '#9CA3AF' }}>
                          {appt.time}
                        </span>
                        <span className="text-xs font-600" style={{ color: asc.color, fontFamily: 'var(--font-display)' }}>
                          {asc.label}
                        </span>
                      </div>
                      <p className="text-xs font-600 text-gray-800 leading-snug" style={{ fontFamily: 'var(--font-display)' }}>
                        {appt.name}
                      </p>
                      <p className="text-xs text-gray-400">{appt.doctor} · {appt.type}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showAppt     && <AppointmentModal onClose={() => setShowAppt(false)} />}

      {/* ── WhatsApp drawer ─────────────────────────────────────────────────── */}
      {showWa && (
        <WhatsAppDrawer
          messages={waMessages}
          onClose={() => setShowWa(false)}
          onMarkRead={markWaRead}
        />
      )}

      {/* ── Patient profile ──────────────────────────────────────────────────── */}
      {selectedPatient && (
        <PatientProfilePage
          patient={patients.find(p => p.id === selectedPatient.id) ?? selectedPatient}
          patients={patients}
          onClose={() => setSelectedPatient(null)}
          onCheckIn={() => handleCheckIn(selectedPatient.id)}
        />
      )}
    </div>
  )
}
