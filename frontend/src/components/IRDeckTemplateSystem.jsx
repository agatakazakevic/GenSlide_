import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  ArrowUpRight,
  Users,
  Target,
  TrendingUp,
  DollarSign,
  CheckCircle,
  Globe,
  Shield,
} from 'lucide-react';

const theme = {
  colors: {
    primary: '#3B82F6',
    secondary: '#60A5FA',
    accent: '#93C5FD',
    dark: '#F5FAFF',
    cardBg: '#FFFFFF',
    border: '#D7E7FF',
    text: {
      primary: '#0F172A',
      secondary: '#475569',
      muted: '#94A3B8',
    },
  },
  spacing: {
    xs: '0.5rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '3rem',
    xxl: '4rem',
  },
};

const CoverSlide = ({ data }) => (
  <div
    className="w-full h-full flex items-center justify-center relative overflow-hidden"
    style={{ background: theme.colors.dark }}
  >
    <div className="absolute inset-0 opacity-10">
      <div
        className="absolute top-0 right-0 w-96 h-96 rounded-full"
        style={{ background: `radial-gradient(circle, ${theme.colors.primary} 0%, transparent 70%)` }}
      />
      <div
        className="absolute bottom-0 left-0 w-96 h-96 rounded-full"
        style={{ background: `radial-gradient(circle, ${theme.colors.secondary} 0%, transparent 70%)` }}
      />
    </div>
    <div className="text-center max-w-5xl px-8 z-10">
      <div className="text-sm mb-4 uppercase tracking-widest" style={{ color: theme.colors.secondary }}>
        {data.category || 'Investment Proposal'}
      </div>
      <h1 className="text-7xl font-bold mb-8 leading-tight" style={{ color: theme.colors.text.primary }}>
        {data.title}
      </h1>
      <p className="text-3xl mb-12" style={{ color: theme.colors.text.secondary }}>
        {data.subtitle}
      </p>
      <div className="flex justify-center gap-12 text-base" style={{ color: theme.colors.text.muted }}>
        <span>{data.company}</span>
        <span>•</span>
        <span>{data.date}</span>
        <span>•</span>
        <span>{data.presenter}</span>
      </div>
    </div>
  </div>
);

const MarketProblemSlide = ({ data }) => (
  <div className="w-full h-full p-12" style={{ background: theme.colors.dark }}>
    <div className="mb-8">
      <div className="text-sm uppercase tracking-wider mb-2" style={{ color: theme.colors.secondary }}>
        01 / Market Status & Problems
      </div>
      <h2 className="text-5xl font-bold" style={{ color: theme.colors.text.primary }}>
        {data.title}
      </h2>
    </div>

    <div className="grid grid-cols-2 gap-12 mt-12">
      <div>
        <h3 className="text-2xl font-semibold mb-6" style={{ color: theme.colors.primary }}>
          Market Overview
        </h3>
        <div className="space-y-4">
          {data.marketPoints.map((point, idx) => (
            <div key={idx} className="flex gap-4 p-4 rounded-lg" style={{ background: theme.colors.cardBg }}>
              <div
                className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: theme.colors.primary }}
              >
                <span className="text-sm font-bold">{idx + 1}</span>
              </div>
              <p className="text-lg" style={{ color: theme.colors.text.secondary }}>
                {point}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-semibold mb-6" style={{ color: theme.colors.primary }}>
          Key Problems & Unmet Needs
        </h3>
        <div className="space-y-4">
          {data.problems.map((problem, idx) => (
            <div
              key={idx}
              className="p-5 rounded-lg border-l-4"
              style={{ background: theme.colors.cardBg, borderColor: theme.colors.primary }}
            >
              <h4 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                {problem.title}
              </h4>
              <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                {problem.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const SolutionSlide = ({ data }) => (
  <div className="w-full h-full p-12" style={{ background: theme.colors.dark }}>
    <div className="mb-8">
      <div className="text-sm uppercase tracking-wider mb-2" style={{ color: theme.colors.secondary }}>
        02 / Solution & Technology
      </div>
      <h2 className="text-5xl font-bold" style={{ color: theme.colors.text.primary }}>
        {data.title}
      </h2>
    </div>

    <div className="grid grid-cols-3 gap-6 mb-10">
      {data.features.map((feature, idx) => (
        <div key={idx} className="p-6 rounded-xl" style={{ background: theme.colors.cardBg }}>
          <div
            className="w-16 h-16 rounded-full mb-4 flex items-center justify-center"
            style={{ background: `${theme.colors.primary}20` }}
          >
            <CheckCircle size={32} style={{ color: theme.colors.primary }} />
          </div>
          <h3 className="text-xl font-bold mb-3" style={{ color: theme.colors.text.primary }}>
            {feature.title}
          </h3>
          <p style={{ color: theme.colors.text.secondary }}>{feature.description}</p>
        </div>
      ))}
    </div>

    <div className="p-8 rounded-xl" style={{ background: theme.colors.cardBg }}>
      <h3 className="text-2xl font-semibold mb-6" style={{ color: theme.colors.primary }}>
        Technology Development Status
      </h3>
      <div className="grid grid-cols-4 gap-4">
        {data.developmentStages.map((stage, idx) => (
          <div key={idx} className="text-center">
            <div className="mb-3">
              <div className="text-4xl font-bold" style={{ color: theme.colors.primary }}>
                {stage.progress}%
              </div>
            </div>
            <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
              {stage.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const CommercializationSlide = ({ data }) => {
  const marketData = data.marketData || [
    { year: '2024', value: 100 },
    { year: '2025', value: 250 },
    { year: '2026', value: 450 },
    { year: '2027', value: 750 },
  ];

  return (
    <div className="w-full h-full p-12" style={{ background: theme.colors.dark }}>
      <div className="mb-8">
        <div className="text-sm uppercase tracking-wider mb-2" style={{ color: theme.colors.secondary }}>
          03 / Commercialization Strategy
        </div>
        <h2 className="text-5xl font-bold" style={{ color: theme.colors.text.primary }}>
          {data.title}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-10">
        <div>
          <h3 className="text-2xl font-semibold mb-6" style={{ color: theme.colors.primary }}>
            Target Market & Growth
          </h3>
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marketData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
                <XAxis dataKey="year" stroke={theme.colors.text.muted} />
                <YAxis stroke={theme.colors.text.muted} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {marketData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={theme.colors.primary} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {data.metrics.map((metric, idx) => (
              <div key={idx} className="p-4 rounded-lg" style={{ background: theme.colors.cardBg }}>
                <div className="text-3xl font-bold mb-1" style={{ color: theme.colors.primary }}>
                  {metric.value}
                </div>
                <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-semibold mb-6" style={{ color: theme.colors.primary }}>
            Go-to-Market Strategy
          </h3>
          <div className="space-y-4">
            {data.strategy.map((item, idx) => (
              <div key={idx} className="p-5 rounded-lg" style={{ background: theme.colors.cardBg }}>
                <div className="flex items-start gap-4">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: theme.colors.primary }}
                  >
                    <span className="font-bold">{idx + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2" style={{ color: theme.colors.text.primary }}>
                      {item.phase}
                    </h4>
                    <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const TeamSlide = ({ data }) => (
  <div className="w-full h-full p-12" style={{ background: theme.colors.dark }}>
    <div className="mb-8">
      <div className="text-sm uppercase tracking-wider mb-2" style={{ color: theme.colors.secondary }}>
        04 / Team Introduction
      </div>
      <h2 className="text-5xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
        {data.title}
      </h2>
      <p className="text-xl" style={{ color: theme.colors.text.secondary }}>
        {data.subtitle}
      </p>
    </div>

    <div className="grid grid-cols-4 gap-6 mt-12">
      {data.members.map((member, idx) => (
        <div key={idx} className="text-center p-6 rounded-xl" style={{ background: theme.colors.cardBg }}>
          <div
            className="w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.secondary})` }}
          >
            <Users size={40} style={{ color: theme.colors.text.primary }} />
          </div>
          <h3 className="text-lg font-bold mb-1" style={{ color: theme.colors.text.primary }}>
            {member.name}
          </h3>
          <p className="text-sm mb-3" style={{ color: theme.colors.secondary }}>
            {member.role}
          </p>
          <p className="text-xs leading-relaxed" style={{ color: theme.colors.text.muted }}>
            {member.bio}
          </p>
        </div>
      ))}
    </div>
  </div>
);

const SecuritySlide = ({ data }) => (
  <div className="w-full h-full p-12" style={{ background: theme.colors.dark }}>
    <div className="mb-8">
      <div className="text-sm uppercase tracking-wider mb-2" style={{ color: theme.colors.secondary }}>
        05 / R&D Safety and Security Compliance
      </div>
      <h2 className="text-5xl font-bold" style={{ color: theme.colors.text.primary }}>
        {data.title}
      </h2>
    </div>

    <div className="grid grid-cols-2 gap-8">
      {data.sections.map((section, idx) => (
        <div key={idx} className="p-8 rounded-xl" style={{ background: theme.colors.cardBg }}>
          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center"
              style={{ background: theme.colors.primary }}
            >
              <Shield size={24} style={{ color: theme.colors.text.primary }} />
            </div>
            <h3 className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
              {section.title}
            </h3>
          </div>
          <ul className="space-y-3">
            {section.measures.map((measure, mIdx) => (
              <li key={mIdx} className="flex items-start gap-3">
                <CheckCircle size={20} className="flex-shrink-0 mt-1" style={{ color: theme.colors.primary }} />
                <span style={{ color: theme.colors.text.secondary }}>{measure}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  </div>
);

const CompetitiveLandscapeSlide = ({ data }) => (
  <div className="w-full h-full p-12" style={{ background: theme.colors.dark }}>
    <div className="mb-8">
      <div className="text-sm uppercase tracking-wider mb-2" style={{ color: theme.colors.secondary }}>
        Competitive Analysis
      </div>
      <h2 className="text-5xl font-bold" style={{ color: theme.colors.text.primary }}>
        {data.title}
      </h2>
    </div>

    <div className="mb-8">
      <h3 className="text-2xl font-semibold mb-6" style={{ color: theme.colors.primary }}>
        Competitive Positioning Matrix
      </h3>
      <div className="relative h-96 p-8 rounded-xl" style={{ background: theme.colors.cardBg }}>
        <div className="absolute bottom-8 left-8 right-8 h-px" style={{ background: theme.colors.border }} />
        <div className="absolute bottom-8 left-8 top-8 w-px" style={{ background: theme.colors.border }} />

        <div className="absolute bottom-2 right-8 text-sm" style={{ color: theme.colors.text.muted }}>
          Innovation →
        </div>
        <div className="absolute left-2 top-8 text-sm rotate-90 origin-left" style={{ color: theme.colors.text.muted }}>
          Market Share →
        </div>

        {data.competitors.map((comp, idx) => (
          <div
            key={idx}
            className="absolute w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              left: `${comp.x}%`,
              bottom: `${comp.y}%`,
              background: comp.isUs ? theme.colors.primary : theme.colors.cardBg,
              border: `3px solid ${comp.isUs ? theme.colors.primary : theme.colors.border}`,
              transform: 'translate(-50%, 50%)',
            }}
          >
            <div className="text-center">
              <div className="font-bold text-xs" style={{ color: theme.colors.text.primary }}>
                {comp.name}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="grid grid-cols-3 gap-4">
      {data.advantages.map((adv, idx) => (
        <div key={idx} className="p-5 rounded-lg" style={{ background: theme.colors.cardBg }}>
          <div className="text-3xl font-bold mb-2" style={{ color: theme.colors.primary }}>
            {adv.metric}
          </div>
          <div className="text-sm" style={{ color: theme.colors.text.secondary }}>
            {adv.description}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const FinancialProjectionsSlide = ({ data }) => {
  const revenueData = data.projections || [
    { year: '2024', revenue: 2, expenses: 1.5 },
    { year: '2025', revenue: 8, expenses: 4 },
    { year: '2026', revenue: 25, expenses: 10 },
    { year: '2027', revenue: 60, expenses: 20 },
    { year: '2028', revenue: 120, expenses: 35 },
  ];

  return (
    <div className="w-full h-full p-12" style={{ background: theme.colors.dark }}>
      <div className="mb-8">
        <div className="text-sm uppercase tracking-wider mb-2" style={{ color: theme.colors.secondary }}>
          Financial Outlook
        </div>
        <h2 className="text-5xl font-bold" style={{ color: theme.colors.text.primary }}>
          {data.title}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-10">
        <div>
          <h3 className="text-2xl font-semibold mb-6" style={{ color: theme.colors.primary }}>
            Revenue & Expense Projections
          </h3>
          <div className="h-72 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.colors.border} />
                <XAxis dataKey="year" stroke={theme.colors.text.muted} />
                <YAxis stroke={theme.colors.text.muted} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={theme.colors.primary}
                  strokeWidth={3}
                  name="Revenue"
                  dot={{ fill: theme.colors.primary, r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke={theme.colors.secondary}
                  strokeWidth={3}
                  name="Expenses"
                  dot={{ fill: theme.colors.secondary, r: 6 }}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-semibold mb-6" style={{ color: theme.colors.primary }}>
            Key Financial Metrics (2027)
          </h3>
          <div className="space-y-6">
            {data.metrics.map((metric, idx) => (
              <div key={idx} className="p-6 rounded-xl" style={{ background: theme.colors.cardBg }}>
                <div className="flex justify-between items-start mb-2">
                  <div className="text-sm" style={{ color: theme.colors.text.muted }}>
                    {metric.label}
                  </div>
                  {metric.trend && (
                    <div className="flex items-center gap-1" style={{ color: theme.colors.primary }}>
                      <TrendingUp size={16} />
                      <span className="text-sm">{metric.trend}</span>
                    </div>
                  )}
                </div>
                <div className="text-4xl font-bold" style={{ color: theme.colors.text.primary }}>
                  {metric.value}
                </div>
                {metric.subtitle && (
                  <div className="text-sm mt-2" style={{ color: theme.colors.text.secondary }}>
                    {metric.subtitle}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 p-6 rounded-xl" style={{ background: theme.colors.cardBg }}>
        <h3 className="text-xl font-semibold mb-4" style={{ color: theme.colors.primary }}>
          Unit Economics
        </h3>
        <div className="grid grid-cols-4 gap-4">
          {data.unitEconomics.map((item, idx) => (
            <div key={idx} className="text-center">
              <div className="text-2xl font-bold mb-1" style={{ color: theme.colors.primary }}>
                {item.value}
              </div>
              <div className="text-xs" style={{ color: theme.colors.text.muted }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const RoadmapSlide = ({ data }) => (
  <div className="w-full h-full p-12" style={{ background: theme.colors.dark }}>
    <div className="mb-8">
      <div className="text-sm uppercase tracking-wider mb-2" style={{ color: theme.colors.secondary }}>
        Product Development
      </div>
      <h2 className="text-5xl font-bold" style={{ color: theme.colors.text.primary }}>
        {data.title}
      </h2>
    </div>

    <div className="relative mt-12">
      <div className="absolute top-8 left-0 right-0 h-1" style={{ background: theme.colors.border }} />

      <div className="grid grid-cols-4 gap-4">
        {data.phases.map((phase, idx) => (
          <div key={idx} className="relative">
            <div
              className="absolute top-6 left-1/2 w-6 h-6 rounded-full -translate-x-1/2"
              style={{
                background: phase.completed ? theme.colors.primary : theme.colors.cardBg,
                border: `3px solid ${phase.completed ? theme.colors.primary : theme.colors.border}`,
              }}
            />

            <div className="pt-16">
              <div className="p-6 rounded-xl min-h-64" style={{ background: theme.colors.cardBg }}>
                <div className="text-sm mb-2 font-semibold" style={{ color: theme.colors.secondary }}>
                  {phase.quarter}
                </div>
                <h3 className="text-xl font-bold mb-4" style={{ color: theme.colors.text.primary }}>
                  {phase.title}
                </h3>
                <ul className="space-y-2">
                  {phase.milestones.map((milestone, mIdx) => (
                    <li
                      key={mIdx}
                      className="flex items-start gap-2 text-sm"
                      style={{ color: theme.colors.text.secondary }}
                    >
                      <CheckCircle
                        size={16}
                        className="flex-shrink-0 mt-0.5"
                        style={{
                          color: phase.completed ? theme.colors.primary : theme.colors.text.muted,
                        }}
                      />
                      <span>{milestone}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const BusinessModelSlide = ({ data }) => (
  <div className="w-full h-full p-12" style={{ background: theme.colors.dark }}>
    <div className="mb-6">
      <div className="text-sm uppercase tracking-wider mb-2" style={{ color: theme.colors.secondary }}>
        Business Model
      </div>
      <h2 className="text-5xl font-bold" style={{ color: theme.colors.text.primary }}>
        {data.title}
      </h2>
    </div>

    <div className="grid grid-cols-4 grid-rows-3 gap-4 h-5/6">
      <div className="row-span-2 p-6 rounded-xl" style={{ background: theme.colors.cardBg }}>
        <h3 className="font-bold mb-3 text-lg" style={{ color: theme.colors.primary }}>
          Key Partners
        </h3>
        <ul className="space-y-2 text-sm" style={{ color: theme.colors.text.secondary }}>
          {data.keyPartners.map((partner, idx) => (
            <li key={idx}>• {partner}</li>
          ))}
        </ul>
      </div>

      <div className="p-6 rounded-xl" style={{ background: theme.colors.cardBg }}>
        <h3 className="font-bold mb-3 text-lg" style={{ color: theme.colors.primary }}>
          Key Activities
        </h3>
        <ul className="space-y-1 text-sm" style={{ color: theme.colors.text.secondary }}>
          {data.keyActivities.map((activity, idx) => (
            <li key={idx}>• {activity}</li>
          ))}
        </ul>
      </div>

      <div className="row-span-2 p-6 rounded-xl" style={{ background: theme.colors.primary }}>
        <h3 className="font-bold mb-3 text-lg" style={{ color: theme.colors.text.primary }}>
          Value Proposition
        </h3>
        <ul className="space-y-2 text-sm font-medium" style={{ color: theme.colors.text.primary }}>
          {data.valueProposition.map((value, idx) => (
            <li key={idx}>• {value}</li>
          ))}
        </ul>
      </div>

      <div className="p-6 rounded-xl" style={{ background: theme.colors.cardBg }}>
        <h3 className="font-bold mb-3 text-lg" style={{ color: theme.colors.primary }}>
          Customer Relations
        </h3>
        <ul className="space-y-1 text-sm" style={{ color: theme.colors.text.secondary }}>
          {data.customerRelations.map((relation, idx) => (
            <li key={idx}>• {relation}</li>
          ))}
        </ul>
      </div>

      <div className="row-span-2 p-6 rounded-xl" style={{ background: theme.colors.cardBg }}>
        <h3 className="font-bold mb-3 text-lg" style={{ color: theme.colors.primary }}>
          Customer Segments
        </h3>
        <ul className="space-y-2 text-sm" style={{ color: theme.colors.text.secondary }}>
          {data.customerSegments.map((segment, idx) => (
            <li key={idx}>• {segment}</li>
          ))}
        </ul>
      </div>

      <div className="p-6 rounded-xl" style={{ background: theme.colors.cardBg }}>
        <h3 className="font-bold mb-3 text-lg" style={{ color: theme.colors.primary }}>
          Key Resources
        </h3>
        <ul className="space-y-1 text-sm" style={{ color: theme.colors.text.secondary }}>
          {data.keyResources.map((resource, idx) => (
            <li key={idx}>• {resource}</li>
          ))}
        </ul>
      </div>

      <div className="p-6 rounded-xl" style={{ background: theme.colors.cardBg }}>
        <h3 className="font-bold mb-3 text-lg" style={{ color: theme.colors.primary }}>
          Channels
        </h3>
        <ul className="space-y-1 text-sm" style={{ color: theme.colors.text.secondary }}>
          {data.channels.map((channel, idx) => (
            <li key={idx}>• {channel}</li>
          ))}
        </ul>
      </div>

      <div className="col-span-2 p-6 rounded-xl" style={{ background: theme.colors.cardBg }}>
        <h3 className="font-bold mb-3 text-lg" style={{ color: theme.colors.primary }}>
          Cost Structure
        </h3>
        <div className="flex gap-4 text-sm" style={{ color: theme.colors.text.secondary }}>
          {data.costStructure.map((cost, idx) => (
            <div key={idx}>• {cost}</div>
          ))}
        </div>
      </div>

      <div className="col-span-2 p-6 rounded-xl" style={{ background: theme.colors.cardBg }}>
        <h3 className="font-bold mb-3 text-lg" style={{ color: theme.colors.primary }}>
          Revenue Streams
        </h3>
        <div className="flex gap-4 text-sm" style={{ color: theme.colors.text.secondary }}>
          {data.revenueStreams.map((stream, idx) => (
            <div key={idx}>• {stream}</div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const MarketSizeSlide = ({ data }) => {
  const marketSegments = data.segments || [
    { name: 'Enterprise', value: 45, color: theme.colors.primary },
    { name: 'SMB', value: 30, color: theme.colors.secondary },
    { name: 'Government', value: 15, color: theme.colors.accent },
    { name: 'Other', value: 10, color: theme.colors.text.muted },
  ];

  return (
    <div className="w-full h-full p-12" style={{ background: theme.colors.dark }}>
      <div className="mb-8">
        <div className="text-sm uppercase tracking-wider mb-2" style={{ color: theme.colors.secondary }}>
          Market Analysis
        </div>
        <h2 className="text-5xl font-bold" style={{ color: theme.colors.text.primary }}>
          {data.title}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-10">
        <div>
          <h3 className="text-2xl font-semibold mb-6" style={{ color: theme.colors.primary }}>
            Market Opportunity
          </h3>
          <div className="space-y-6">
            <div className="p-8 rounded-xl relative overflow-hidden" style={{ background: theme.colors.cardBg }}>
              <div
                className="absolute inset-0 opacity-10"
                style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, transparent)` }}
              />
              <div className="relative">
                <div className="text-sm mb-2" style={{ color: theme.colors.text.muted }}>
                  TAM (Total Addressable Market)
                </div>
                <div className="text-5xl font-bold" style={{ color: theme.colors.primary }}>
                  ${data.tam}B
                </div>
                <div className="text-sm mt-2" style={{ color: theme.colors.text.secondary }}>
                  Global market size for AI solutions
                </div>
              </div>
            </div>

            <div className="p-8 rounded-xl relative overflow-hidden" style={{ background: theme.colors.cardBg }}>
              <div
                className="absolute inset-0 opacity-10"
                style={{ background: `linear-gradient(135deg, ${theme.colors.secondary}, transparent)` }}
              />
              <div className="relative">
                <div className="text-sm mb-2" style={{ color: theme.colors.text.muted }}>
                  SAM (Serviceable Addressable Market)
                </div>
                <div className="text-5xl font-bold" style={{ color: theme.colors.secondary }}>
                  ${data.sam}B
                </div>
                <div className="text-sm mt-2" style={{ color: theme.colors.text.secondary }}>
                  Target segments we can reach
                </div>
              </div>
            </div>

            <div className="p-8 rounded-xl relative overflow-hidden" style={{ background: theme.colors.cardBg }}>
              <div
                className="absolute inset-0 opacity-10"
                style={{ background: `linear-gradient(135deg, ${theme.colors.accent}, transparent)` }}
              />
              <div className="relative">
                <div className="text-sm mb-2" style={{ color: theme.colors.text.muted }}>
                  SOM (Serviceable Obtainable Market)
                </div>
                <div className="text-5xl font-bold" style={{ color: theme.colors.accent }}>
                  ${data.som}B
                </div>
                <div className="text-sm mt-2" style={{ color: theme.colors.text.secondary }}>
                  Realistic capture in 3 years
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-2xl font-semibold mb-6" style={{ color: theme.colors.primary }}>
            Market Segmentation
          </h3>
          <div className="h-80 flex items-center justify-center mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={marketSegments}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={140}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {marketSegments.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {marketSegments.map((segment, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-4 h-4 rounded" style={{ background: segment.color }} />
                <div>
                  <div className="font-semibold" style={{ color: theme.colors.text.primary }}>
                    {segment.name}
                  </div>
                  <div className="text-sm" style={{ color: theme.colors.text.muted }}>
                    {segment.value}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const TEMPLATE_COMPONENTS = {
  cover: CoverSlide,
  market: MarketProblemSlide,
  solution: SolutionSlide,
  commercialization: CommercializationSlide,
  team: TeamSlide,
  security: SecuritySlide,
  competitive: CompetitiveLandscapeSlide,
  financials: FinancialProjectionsSlide,
  roadmap: RoadmapSlide,
  businessModel: BusinessModelSlide,
  marketSize: MarketSizeSlide,
};

export const IRDeckSlide = ({ slide }) => {
  const Component = TEMPLATE_COMPONENTS[slide?.irTemplate];
  if (!Component) return null;
  return <Component data={slide.irData || {}} />;
};

export default function IRDeckTemplateSystem() {
  const [currentTemplate, setCurrentTemplate] = useState('cover');

  const templates = {
    cover: {
      name: 'Cover',
      component: CoverSlide,
      data: {
        category: 'Series A Investment Proposal',
        title: 'Revolutionary AI-Powered Solutions',
        subtitle: 'Transforming Industries Through Advanced Technology',
        company: 'TechVenture Inc.',
        date: 'January 2026',
        presenter: 'Dr. Sarah Kim, CEO',
      },
    },
    market: {
      name: '01 Market & Problems',
      component: MarketProblemSlide,
      data: {
        title: 'Market Status & Key Problems',
        marketPoints: [
          'Global AI market projected to reach $500B by 2027',
          'Enterprise adoption growing at 45% CAGR',
          'Increasing demand for automated solutions',
        ],
        problems: [
          {
            title: 'High Implementation Costs',
            description: 'Traditional solutions require significant upfront investment and long deployment cycles',
          },
          {
            title: 'Technical Complexity',
            description: 'Lack of expertise and integration challenges prevent widespread adoption',
          },
          {
            title: 'Limited Scalability',
            description: 'Existing platforms struggle to handle growing data volumes and user demands',
          },
        ],
      },
    },
    solution: {
      name: '02 Solution & Tech',
      component: SolutionSlide,
      data: {
        title: 'Our Solution & Technology',
        features: [
          {
            title: 'AI-Powered Automation',
            description: 'Advanced ML algorithms reduce manual work by 80%',
          },
          {
            title: 'Cloud-Native Platform',
            description: 'Scalable infrastructure supporting millions of users',
          },
          {
            title: 'Enterprise Integration',
            description: 'Seamless connection with existing business systems',
          },
        ],
        developmentStages: [
          { name: 'Core Technology', progress: 95 },
          { name: 'Standardization', progress: 70 },
          { name: 'Commercialization', progress: 60 },
          { name: 'Market Validation', progress: 45 },
        ],
      },
    },
    commercialization: {
      name: '03 Commercialization',
      component: CommercializationSlide,
      data: {
        title: 'Commercialization Strategy',
        metrics: [
          { value: '$2.5B', label: 'Target Market Size' },
          { value: '15%', label: 'Expected Market Share' },
        ],
        strategy: [
          {
            phase: 'Phase 1: Pilot Programs',
            description: 'Launch with 5 major enterprise clients, validate product-market fit',
          },
          {
            phase: 'Phase 2: Market Expansion',
            description: 'Scale to 50+ enterprise customers, establish market presence',
          },
          {
            phase: 'Phase 3: Global Growth',
            description: 'Enter international markets, expand to 500+ enterprise clients',
          },
        ],
      },
    },
    team: {
      name: '04 Team',
      component: TeamSlide,
      data: {
        title: 'Leadership Team',
        subtitle: 'World-class team with proven track record',
        members: [
          {
            name: 'Dr. Sarah Kim',
            role: 'CEO & Founder',
            bio: 'PhD Stanford, 15 years AI research, 2x successful exits',
          },
          {
            name: 'James Park',
            role: 'CTO',
            bio: 'Former Google AI Lead, 20+ patents in ML/AI',
          },
          {
            name: 'Lisa Chen',
            role: 'CFO',
            bio: 'ex-Goldman Sachs, scaled 3 companies to $100M+',
          },
          {
            name: 'Mike Johnson',
            role: 'VP Engineering',
            bio: 'Built systems serving 100M+ users at Meta',
          },
        ],
      },
    },
    security: {
      name: '05 Security & Compliance',
      component: SecuritySlide,
      data: {
        title: 'Safety & Security Compliance',
        sections: [
          {
            title: 'Safety Measures',
            measures: [
              'ISO 27001 certified information security management',
              'Regular security audits by third-party experts',
              'Data backup and disaster recovery protocols',
              '24/7 security monitoring and incident response',
            ],
          },
          {
            title: 'Security Implementation',
            measures: [
              'End-to-end encryption for all data transmission',
              'Multi-factor authentication for user access',
              'Role-based access control (RBAC) system',
              'Compliance with GDPR, SOC 2, and industry standards',
            ],
          },
          {
            title: 'IP Protection',
            measures: [
              'Patent portfolio covering core technologies',
              'Trade secret protection programs',
              'Employee confidentiality agreements',
              'Secure code repository with access logging',
            ],
          },
          {
            title: 'Compliance Measures',
            measures: [
              'Regular compliance training for all employees',
              'Data privacy impact assessments',
              'Vendor security assessment program',
              'Annual third-party compliance certification',
            ],
          },
        ],
      },
    },
    competitive: {
      name: 'Competitive Analysis',
      component: CompetitiveLandscapeSlide,
      data: {
        title: 'Competitive Landscape',
        competitors: [
          { name: 'Us', x: 75, y: 70, isUs: true },
          { name: 'Comp A', x: 50, y: 60, isUs: false },
          { name: 'Comp B', x: 40, y: 40, isUs: false },
          { name: 'Comp C', x: 60, y: 30, isUs: false },
          { name: 'Comp D', x: 30, y: 50, isUs: false },
        ],
        advantages: [
          { metric: '3x Faster', description: 'Time to deployment vs competitors' },
          { metric: '50% Lower', description: 'Total cost of ownership' },
          { metric: '99.9%', description: 'Uptime guarantee SLA' },
        ],
      },
    },
    financials: {
      name: 'Financial Projections',
      component: FinancialProjectionsSlide,
      data: {
        title: '5-Year Financial Projections',
        metrics: [
          { label: 'Annual Revenue', value: '$60M', trend: '+350%', subtitle: 'Year 3 target' },
          { label: 'Gross Margin', value: '78%', trend: '+15%', subtitle: 'Industry leading' },
          { label: 'CAC Payback', value: '8 months', subtitle: 'Efficient unit economics' },
        ],
        unitEconomics: [
          { label: 'Customer LTV', value: '$125K' },
          { label: 'CAC', value: '$18K' },
          { label: 'LTV:CAC Ratio', value: '7:1' },
          { label: 'Churn Rate', value: '<5%' },
        ],
      },
    },
    roadmap: {
      name: 'Product Roadmap',
      component: RoadmapSlide,
      data: {
        title: 'Product Development Roadmap',
        phases: [
          {
            quarter: 'Q1 2026',
            title: 'MVP Launch',
            completed: true,
            milestones: [
              'Core platform release',
              'Beta customer onboarding',
              'Initial feature set live',
              'Performance benchmarks met',
            ],
          },
          {
            quarter: 'Q2 2026',
            title: 'Enterprise Features',
            completed: true,
            milestones: [
              'Advanced analytics dashboard',
              'SSO integration',
              'Custom reporting tools',
              'API v2.0 release',
            ],
          },
          {
            quarter: 'Q3 2026',
            title: 'Scale & Optimize',
            completed: false,
            milestones: [
              'Multi-region deployment',
              'Performance optimization',
              'Mobile app launch',
              'AI model improvements',
            ],
          },
          {
            quarter: 'Q4 2026',
            title: 'Market Expansion',
            completed: false,
            milestones: [
              'International markets',
              'Industry-specific solutions',
              'Partner ecosystem launch',
              'Advanced automation features',
            ],
          },
        ],
      },
    },
    businessModel: {
      name: 'Business Model',
      component: BusinessModelSlide,
      data: {
        title: 'Business Model Canvas',
        keyPartners: ['Cloud infrastructure providers', 'Technology partners', 'Strategic investors', 'Industry consultants'],
        keyActivities: ['Platform development', 'Customer support', 'Sales & marketing'],
        keyResources: ['Proprietary AI technology', 'Engineering team', 'Customer data'],
        valueProposition: [
          '80% reduction in manual work',
          'Real-time insights & automation',
          'Enterprise-grade security',
          'Seamless integration',
          'Scalable infrastructure',
        ],
        customerRelations: ['Dedicated account managers', '24/7 support', 'Community forums'],
        channels: ['Direct sales', 'Partner network', 'Digital marketing'],
        customerSegments: ['Enterprise companies (500+)', 'Mid-market (100-500)', 'Government agencies', 'Industry verticals'],
        costStructure: ['R&D & engineering', 'Sales & marketing', 'Cloud infrastructure', 'Customer success'],
        revenueStreams: ['Subscription (SaaS)', 'Enterprise licenses', 'Professional services', 'API usage fees'],
      },
    },
    marketSize: {
      name: 'Market Size',
      component: MarketSizeSlide,
      data: {
        title: 'Market Size & Opportunity',
        tam: '500',
        sam: '150',
        som: '15',
      },
    },
  };

  const CurrentSlide = templates[currentTemplate].component;

  return (
    <div className="min-h-screen" style={{ background: theme.colors.dark }}>
      <div
        className="flex gap-2 p-4 overflow-x-auto border-b"
        style={{ background: theme.colors.cardBg, borderColor: theme.colors.border }}
      >
        {Object.entries(templates).map(([key, template]) => (
          <button
            key={key}
            onClick={() => setCurrentTemplate(key)}
            className="px-6 py-3 rounded-lg whitespace-nowrap transition-all font-medium"
            style={{
              background: currentTemplate === key ? theme.colors.primary : 'transparent',
              color: currentTemplate === key ? theme.colors.text.primary : theme.colors.text.secondary,
              border: `1px solid ${currentTemplate === key ? theme.colors.primary : theme.colors.border}`,
            }}
          >
            {template.name}
          </button>
        ))}
      </div>

      <div className="aspect-video max-w-7xl mx-auto my-8 rounded-xl overflow-hidden shadow-2xl">
        <CurrentSlide data={templates[currentTemplate].data} />
      </div>

      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="p-6 rounded-lg" style={{ background: theme.colors.cardBg }}>
          <h3 className="text-xl font-semibold mb-3" style={{ color: theme.colors.text.primary }}>
            IR Deck Template: {templates[currentTemplate].name}
          </h3>
          <p className="mb-3" style={{ color: theme.colors.text.secondary }}>
            Professional investment presentation template following standard IR deck structure.
          </p>
          <div className="flex gap-4 text-sm" style={{ color: theme.colors.text.muted }}>
            <span>✓ Professional Design</span>
            <span>✓ Data Visualization</span>
            <span>✓ Consistent Branding</span>
            <span>✓ Investment-Ready</span>
          </div>
        </div>
      </div>
    </div>
  );
}
