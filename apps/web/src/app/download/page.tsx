"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  DownloadIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  CheckCircle2Icon,
  CopyIcon,
  ArrowLeftIcon,
  SparklesIcon,
} from "../../components/icons";

export default function DownloadPortalPage() {
  const [copied, setCopied] = useState(false);
  const sha256Checksum =
    "a335402f8e08d340bd8b32f31f05f54164be0c13407347207957907f84696ee1";

  const handleCopyChecksum = () => {
    navigator.clipboard.writeText(sha256Checksum);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* Top Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeftIcon size={16} />
            Back to Shift Board
          </Link>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Production Release v1.0.0
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 mb-4 shadow-sm">
            <SmartphoneIcon size={36} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Telecalling CRM for Android
          </h1>
          <p className="mt-3 text-base text-slate-600 leading-relaxed">
            Universal Android auto-dialer with multi-OEM background telephony, offline-first SQLite queue, automatic call recording synchronization, and WhatsApp templates.
          </p>

          {/* Primary Action Button */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="/telecalling-crm.apk"
              download="telecalling-crm.apk"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-indigo-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-700 active:scale-95 transition-all"
            >
              <DownloadIcon size={20} />
              Download Signed APK (v1.0.0)
            </a>
            <div className="text-xs text-slate-500 text-left">
              <div>Package: <code className="font-mono text-slate-700">com.telecalling.crm</code></div>
              <div>Size: <span className="font-medium text-slate-700">76 MB</span> · Android 8.0 to 15</div>
            </div>
          </div>
        </div>

        {/* Checksum & Integrity Badge */}
        <div className="mb-12 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                <ShieldCheckIcon size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Cryptographic Integrity Signature</h3>
                <p className="text-xs text-slate-500">SHA-256 release checksum matching official build</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <code className="text-xs font-mono bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-700 select-all overflow-x-auto max-w-full">
                {sha256Checksum}
              </code>
              <button
                onClick={handleCopyChecksum}
                className="shrink-0 p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
                title="Copy SHA-256"
              >
                {copied ? <CheckCircle2Icon size={16} className="text-emerald-600" /> : <CopyIcon size={16} />}
              </button>
            </div>
          </div>
        </div>

        {/* 3-Step Setup Instructions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-sm mb-4">
              1
            </div>
            <h4 className="font-semibold text-slate-900 mb-2">Enable Sideloading</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              When downloading from Chrome or your mobile browser, tap <strong>&ldquo;Settings&rdquo;</strong> on the security prompt and allow <strong>&ldquo;Install unknown apps&rdquo;</strong> for this source.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-sm mb-4">
              2
            </div>
            <h4 className="font-semibold text-slate-900 mb-2">Install & Grant Permissions</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Open the downloaded APK and tap <strong>Install</strong>. Upon launch, grant Phone, Call Logs, Notifications, and Storage Access Framework (SAF) folder access for your OEM recorder.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold text-sm mb-4">
              3
            </div>
            <h4 className="font-semibold text-slate-900 mb-2">Disable Battery Saver</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Set Telecalling CRM to <strong>&ldquo;Unrestricted&rdquo;</strong> or disable battery optimization so the background call watcher is never terminated by Android during shifts.
            </p>
          </div>
        </div>

        {/* Multi-OEM Compatibility Matrix */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <SparklesIcon size={18} className="text-amber-500" />
            <h3 className="font-semibold text-slate-900">Universal Multi-OEM Support Matrix</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="font-semibold text-slate-800 mb-1">Samsung (One UI)</div>
              <div className="text-slate-500">Galaxy M15, A15, M34</div>
              <div className="mt-2 text-emerald-700 font-medium">✓ SAF: Recordings/Call</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="font-semibold text-slate-800 mb-1">Xiaomi (HyperOS/MIUI)</div>
              <div className="text-slate-500">Redmi, Poco, Mi Series</div>
              <div className="mt-2 text-emerald-700 font-medium">✓ SAF: sound_recorder/call_rec</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="font-semibold text-slate-800 mb-1">Vivo (Funtouch OS)</div>
              <div className="text-slate-500">Vivo V/T, iQOO Series</div>
              <div className="mt-2 text-emerald-700 font-medium">✓ SAF: Record/Call</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="font-semibold text-slate-800 mb-1">Realme / Oppo</div>
              <div className="text-slate-500">Realme 12x 5G, ColorOS</div>
              <div className="mt-2 text-emerald-700 font-medium">✓ SAF: Recordings/Call</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

