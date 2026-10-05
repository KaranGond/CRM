import { formatCallDuration, calcConversionRate } from "@telecalling-crm/utils";

const stats = [
  { label: "Total Leads", value: "1,250", icon: "👥" },
  { label: "Calls Today", value: "127", icon: "📞" },
  { label: "Active Campaigns", value: "5", icon: "📊" },
  { label: "Conversion Rate", value: `${calcConversionRate(156, 1250)}%`, icon: "🎯" },
  { label: "Avg. Call Duration", value: formatCallDuration(185), icon: "⏱️" },
  { label: "Active Agents", value: "24", icon: "🧑‍💼" },
];

export default function HomePage() {
  return (
    <main style={{ minHeight: "100vh", padding: "2rem" }}>
      {/* Header */}
      <header style={{ marginBottom: "2.5rem" }}>
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 800,
            background: "linear-gradient(135deg, #6366f1, #a5b4fc)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: "0.5rem",
          }}
        >
          Telecalling CRM
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: "1rem" }}>
          Dashboard Overview
        </p>
      </header>

      {/* Stats Grid */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>{stat.icon}</span>
            <span
              style={{
                fontSize: "1.75rem",
                fontWeight: 700,
                color: "var(--text-primary)",
              }}
            >
              {stat.value}
            </span>
            <span
              style={{ fontSize: "0.875rem", color: "var(--text-secondary)" }}
            >
              {stat.label}
            </span>
          </div>
        ))}
      </section>

      {/* Placeholder sections */}
      <section
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border)",
          padding: "2rem",
          textAlign: "center",
          color: "var(--text-muted)",
        }}
      >
        <p style={{ fontSize: "1.125rem", marginBottom: "0.5rem" }}>
          🚀 Monorepo is set up and ready
        </p>
        <p style={{ fontSize: "0.875rem" }}>
          Shared types, validation, utils, and UI components are wired across
          NestJS API, Next.js Web, and Expo Mobile.
        </p>
      </section>
    </main>
  );
}
