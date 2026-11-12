/**
 * DeepSeek 余额仪表盘 —— 浏览器半边。
 *
 * 在「设置」里注册一个 `settings.section` 页面：环形余额仪表、余额构成、
 * 消耗速度与余额趋势。数据来自 Host 半边的 /api/deepseek-balance/summary。
 */

window.__ModuleLoader__.load({
	id: 'dsh-plugin-deepseek-balance',
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

		const React = require('react');
		const h = React.createElement;

		/* ---------------------------------------------------------- 样式 */

		const css = `
.dsb-root{display:flex;flex-direction:column;gap:16px;padding:2px 0 10px;color:var(--dsw-alias-label-primary,inherit);font-size:13px;line-height:1.5}
.dsb-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}
.dsb-title{font-size:15px;font-weight:600;letter-spacing:-.01em}
.dsb-sub{margin-top:4px;font-size:12px;color:var(--dsw-alias-label-tertiary,#8a8f98)}
.dsb-actions{display:flex;align-items:center;gap:8px;flex:none}
.dsb-live{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.25));font-size:11.5px;color:var(--dsw-alias-label-tertiary,#8a8f98)}
.dsb-dot{width:6px;height:6px;border-radius:50%;background:#3ddc97;box-shadow:0 0 0 3px rgba(61,220,151,.16)}
.dsb-live[data-state="stale"] .dsb-dot{background:#ffc861;box-shadow:0 0 0 3px rgba(255,200,97,.16)}
.dsb-live[data-state="error"] .dsb-dot{background:#ff5d73;box-shadow:0 0 0 3px rgba(255,93,115,.16)}
.dsb-btn{display:inline-flex;align-items:center;justify-content:center;height:26px;padding:0 12px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.25));background:transparent;color:var(--dsw-alias-label-secondary,#5a6068);font:inherit;font-size:12px;cursor:pointer;transition:background .18s ease,color .18s ease}
.dsb-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.1));color:var(--dsw-alias-label-primary,inherit)}
.dsb-btn:disabled{opacity:.55;cursor:default}
.dsb-card{border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.22));border-radius:16px;background:var(--dsw-alias-settings-card-fill,rgba(128,128,128,.045));padding:16px}
.dsb-hero{display:grid;grid-template-columns:236px minmax(0,1fr);gap:20px;align-items:center}
.dsb-gauge{position:relative;display:grid;place-items:center;width:100%;max-width:236px;margin:0 auto}
.dsb-gauge svg{width:100%;height:auto;display:block}
.dsb-gauge-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;text-align:center;pointer-events:none}
.dsb-kicker{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary,#8a8f98)}
.dsb-amount{display:flex;align-items:baseline;gap:2px;margin-top:2px;font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1.05}
.dsb-amount .dsb-cur{font-size:16px;color:var(--dsw-alias-label-secondary,#5a6068);transform:translateY(-6px)}
.dsb-amount .dsb-num{font-size:34px;font-weight:650}
.dsb-pct{margin-top:4px;font-size:11.5px;color:var(--dsw-alias-label-tertiary,#8a8f98);font-variant-numeric:tabular-nums}
.dsb-pct b{color:var(--dsw-alias-label-secondary,#5a6068);font-weight:600}
.dsb-budget{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:12px;font-size:11.5px;color:var(--dsw-alias-label-tertiary,#8a8f98)}
.dsb-budget input{width:62px;height:24px;padding:0 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.25));background:transparent;color:var(--dsw-alias-label-primary,inherit);font:inherit;font-size:11.5px;text-align:right;font-variant-numeric:tabular-nums}
.dsb-budget input:focus{outline:none;border-color:var(--dsw-alias-state-business-primary,#4d6bfe)}
.dsb-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.dsb-stat{padding:12px 14px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2));background:var(--dsw-alias-bg-elevated,rgba(128,128,128,.05));min-width:0}
.dsb-stat-label{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8f98)}
.dsb-stat-value{margin-top:3px;font-size:17px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dsb-stat-value.dsb-accent{color:#2fbf8f}
.dsb-status{display:inline-flex;align-items:center;gap:7px;font-size:15px}
.dsb-status i{width:7px;height:7px;border-radius:50%;background:#3ddc97;box-shadow:0 0 10px rgba(61,220,151,.8)}
.dsb-status[data-ok="false"] i{background:#ff5d73;box-shadow:0 0 10px rgba(255,93,115,.8)}
.dsb-status[data-ok="unknown"] i{background:#8a8f98;box-shadow:none}
.dsb-chart-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
.dsb-chart-title{font-size:13px;font-weight:600}
.dsb-seg{display:inline-flex;padding:2px;gap:2px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2));background:var(--dsw-alias-bg-elevated,rgba(128,128,128,.05))}
.dsb-seg button{border:0;background:transparent;color:var(--dsw-alias-label-tertiary,#8a8f98);font:inherit;font-size:11px;padding:4px 9px;border-radius:7px;cursor:pointer}
.dsb-seg button[data-active="true"]{background:var(--dsw-alias-bg-elevated,rgba(128,128,128,.16));color:var(--dsw-alias-label-primary,inherit)}
.dsb-chart{width:100%}
.dsb-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-height:150px;color:var(--dsw-alias-label-tertiary,#8a8f98);text-align:center;font-size:12px}
.dsb-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.dsb-metric{padding:13px 14px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.2));background:var(--dsw-alias-bg-elevated,rgba(128,128,128,.05))}
.dsb-metric-label{font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8f98)}
.dsb-metric-value{margin-top:4px;font-size:19px;font-weight:600;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.dsb-metric-value.dsb-neg{color:#ff5d73}
.dsb-metric-value.dsb-pos{color:#2fbf8f}
.dsb-metric-sub{margin-top:3px;font-size:10.5px;color:var(--dsw-alias-label-tertiary,#8a8f98);opacity:.85}
.dsb-note{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:10px;border:1px solid rgba(255,200,97,.35);background:rgba(255,200,97,.12);color:#b4761a;font-size:11.5px}
.dsb-foot{font-size:10.5px;color:var(--dsw-alias-label-tertiary,#8a8f98)}
@media (max-width:720px){.dsb-hero{grid-template-columns:minmax(0,1fr)}.dsb-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
.dsb-bars{display:flex;align-items:flex-end;gap:2px;height:158px;padding:4px 0 0;border-bottom:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.18))}
.dsb-bar{position:relative;flex:1 1 0;min-width:0;display:flex;flex-direction:column;justify-content:flex-end;gap:1px;border-radius:4px 4px 0 0;transition:background .15s ease}
.dsb-bar[data-hover="true"]{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}
.dsb-bar-seg{border-radius:1px}
.dsb-bar-seg[data-kind="cache"]{background:#5b8cff;opacity:.5}
.dsb-bar-seg[data-kind="input"]{background:#48d7c4;opacity:.9}
.dsb-bar-seg[data-kind="output"]{background:#3ddc97}
.dsb-bars-axis{display:flex;gap:2px;margin-top:5px;font-size:9.5px;color:var(--dsw-alias-label-tertiary,#8a8f98)}
.dsb-bars-axis span{flex:1 1 0;min-width:0;text-align:center;white-space:nowrap;overflow:visible}
.dsb-chart-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:8px;font-size:11px;color:var(--dsw-alias-label-tertiary,#8a8f98);min-height:17px}
.dsb-chart-foot b{color:var(--dsw-alias-label-secondary,#5a6068);font-weight:600;font-variant-numeric:tabular-nums}
.dsb-legend{display:inline-flex;align-items:center;gap:12px;font-size:10.5px}
.dsb-legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.dsb-legend i[data-kind="cache"]{background:#5b8cff;opacity:.5}
.dsb-legend i[data-kind="input"]{background:#48d7c4}
.dsb-legend i[data-kind="output"]{background:#3ddc97}
`;
		const STYLE_ID = 'dsh-plugin-deepseek-balance/dashboard.css';
		if (typeof document !== 'undefined' && !document.querySelector(`style[data-plugin-css="${STYLE_ID}"]`)) {
			const tag = document.createElement('style');
			tag.dataset.plugin = 'dsh-plugin-deepseek-balance';
			tag.dataset.pluginCss = STYLE_ID;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		/* ---------------------------------------------------------- 工具 */

		const SIGNS = { CNY: '¥', USD: '$', EUR: '€', JPY: '¥' };

		function signOf(currency) {
			return SIGNS[currency] || (currency ? `${currency} ` : '¥');
		}

		function money(value, digits = 2) {
			if (!Number.isFinite(value)) return '—';
			return Number(value).toLocaleString('zh-CN', {
				minimumFractionDigits: digits,
				maximumFractionDigits: digits,
			});
		}

		function timeOf(ts) {
			return new Date(ts).toLocaleTimeString('zh-CN', {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hour12: false,
			});
		}

		function stampOf(ts) {
			const d = new Date(ts);
			return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
		}

		function durationOf(hours) {
			if (!Number.isFinite(hours) || hours <= 0) return '—';
			if (hours < 1) return `${Math.round(hours * 60)} 分钟`;
			if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)} 小时`;
			return `${(hours / 24).toFixed(1)} 天`;
		}

		function clamp(value, min, max) {
			return Math.min(max, Math.max(min, value));
		}

		function tokens(value) {
			if (!Number.isFinite(value)) return '—';
			const abs = Math.abs(value);
			if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
			if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
			if (abs >= 1e4) return `${(value / 1e3).toFixed(1)}K`;
			return Math.round(value).toLocaleString('zh-CN');
		}

		/* ---------------------------------------------------------- 取数 */

		function useSummary() {
			const [state, setState] = React.useState({ status: 'loading', data: null, error: null });

			React.useEffect(() => {
				let alive = true;

				async function load(force) {
					try {
						const res = await fetch(`/api/deepseek-balance/summary${force ? '?force=1' : ''}`, {
							cache: 'no-store',
							credentials: 'same-origin',
						});
						if (!res.ok) throw new Error(`HTTP ${res.status}`);
						const data = await res.json();
						if (alive) setState({ status: 'ready', data, error: null });
					} catch (error) {
						if (alive) {
							setState((prev) => ({
								status: 'error',
								data: prev.data,
								error: (error && error.message) || String(error),
							}));
						}
					}
				}

				load(false);
				const timer = setInterval(() => load(false), 60_000);
				return () => {
					alive = false;
					clearInterval(timer);
				};
			}, []);

			return {
				...state,
				reload() {
					setState((prev) => ({ ...prev, status: 'loading' }));
					fetch('/api/deepseek-balance/summary?force=1', { cache: 'no-store', credentials: 'same-origin' })
						.then((res) => res.json())
						.then((data) => setState({ status: 'ready', data, error: null }))
						.catch((error) => setState((prev) => ({ ...prev, status: 'error', error: error.message })));
				},
			};
		}

		function useWidth() {
			const ref = React.useRef(null);
			const [width, setWidth] = React.useState(0);
			React.useEffect(() => {
				const node = ref.current;
				if (!node) return undefined;
				const observer = new ResizeObserver((entries) => {
					const box = entries[0];
					if (box) setWidth(box.contentRect.width);
				});
				observer.observe(node);
				setWidth(node.clientWidth);
				return () => observer.disconnect();
			}, []);
			return [ref, width];
		}

		/* ---------------------------------------------------------- 部件 */

		function Gauge({ total, budget, hasBalance, sign }) {
			const radius = 74;
			const circumference = 2 * Math.PI * radius;
			const ratio = hasBalance && budget > 0 ? total / budget : 0;
			const shown = clamp(ratio, 0, 1);
			const gradient = shown >= 0.5 ? 'dsb-arc-ok' : shown >= 0.22 ? 'dsb-arc-warn' : 'dsb-arc-bad';

			return h(
				'div',
				{ className: 'dsb-gauge' },
				h(
					'svg',
					{ viewBox: '0 0 180 180', role: 'img', 'aria-label': '可用余额占预算比例' },
					h(
						'defs',
						null,
						h(
							'linearGradient',
							{ id: 'dsb-arc-ok', x1: '0', y1: '0', x2: '1', y2: '1' },
							h('stop', { offset: '0%', stopColor: '#5b8cff' }),
							h('stop', { offset: '60%', stopColor: '#48d7c4' }),
							h('stop', { offset: '100%', stopColor: '#3ddc97' }),
						),
						h(
							'linearGradient',
							{ id: 'dsb-arc-warn', x1: '0', y1: '0', x2: '1', y2: '1' },
							h('stop', { offset: '0%', stopColor: '#ffc861' }),
							h('stop', { offset: '100%', stopColor: '#ff9f45' }),
						),
						h(
							'linearGradient',
							{ id: 'dsb-arc-bad', x1: '0', y1: '0', x2: '1', y2: '1' },
							h('stop', { offset: '0%', stopColor: '#ff7b72' }),
							h('stop', { offset: '100%', stopColor: '#ff4d6d' }),
						),
					),
					h('circle', {
						cx: 90,
						cy: 90,
						r: radius,
						fill: 'none',
						stroke: 'var(--dsw-alias-border-l2, rgba(128,128,128,.22))',
						strokeWidth: 13,
					}),
					h('circle', {
						cx: 90,
						cy: 90,
						r: radius,
						fill: 'none',
						stroke: `url(#${gradient})`,
						strokeWidth: 13,
						strokeLinecap: 'round',
						strokeDasharray: circumference,
						strokeDashoffset: circumference * (1 - shown),
						transform: 'rotate(-90 90 90)',
						style: { transition: 'stroke-dashoffset .8s cubic-bezier(.22,.68,.32,1)' },
					}),
				),
				h(
					'div',
					{ className: 'dsb-gauge-center' },
					h('span', { className: 'dsb-kicker' }, '可用余额'),
					h(
						'div',
						{ className: 'dsb-amount' },
						h('span', { className: 'dsb-cur' }, sign),
						h('span', { className: 'dsb-num' }, hasBalance ? money(total) : '—'),
					),
					h(
						'div',
						{ className: 'dsb-pct' },
						h('b', null, hasBalance ? `${(ratio * 100).toFixed(1)}%` : '—'),
						' 预算剩余',
					),
				),
			);
		}

		function Trend({ rows, sign }) {
			const [ref, width] = useWidth();
			const height = 190;

			if (!rows || rows.length < 2) {
				return h(
					'div',
					{ ref, className: 'dsb-empty' },
					h('div', null, rows && rows.length === 1 ? '正在采样，趋势生成中' : '还没有采样数据'),
					h('div', { style: { opacity: 0.75 } }, '打开本页后每 60 秒记录一次余额，稍后自动描绘曲线'),
				);
			}

			const w = Math.max(320, width || 640);
			const pad = { top: 16, right: 12, bottom: 22, left: 46 };
			const innerW = w - pad.left - pad.right;
			const innerH = height - pad.top - pad.bottom;

			const values = rows.map((row) => row.total);
			const rawMin = Math.min(...values);
			const rawMax = Math.max(...values);
			const span = rawMax - rawMin || Math.max(rawMax * 0.02, 0.5);
			const min = rawMin - span * 0.18;
			const max = rawMax + span * 0.18;
			const t0 = rows[0].t;
			const t1 = rows[rows.length - 1].t;
			const tSpan = Math.max(t1 - t0, 1);

			const xOf = (t) => pad.left + ((t - t0) / tSpan) * innerW;
			const yOf = (v) => pad.top + (1 - (v - min) / (max - min)) * innerH;

			const points = rows.map((row) => [xOf(row.t), yOf(row.total)]);
			let path = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
			for (let i = 1; i < points.length; i += 1) {
				const prev = points[i - 1];
				const cur = points[i];
				const midX = (prev[0] + cur[0]) / 2;
				path += ` C ${midX.toFixed(1)} ${prev[1].toFixed(1)}, ${midX.toFixed(1)} ${cur[1].toFixed(1)}, ${cur[0].toFixed(1)} ${cur[1].toFixed(1)}`;
			}
			const area = `${path} L ${points[points.length - 1][0].toFixed(1)} ${(pad.top + innerH).toFixed(1)} L ${points[0][0].toFixed(1)} ${(pad.top + innerH).toFixed(1)} Z`;

			const gridlines = [];
			for (let i = 0; i <= 3; i += 1) {
				const value = min + ((max - min) * i) / 3;
				const y = yOf(value);
				gridlines.push(
					h('line', {
						key: `g${i}`,
						x1: pad.left,
						y1: y,
						x2: pad.left + innerW,
						y2: y,
						stroke: 'var(--dsw-alias-border-l2, rgba(128,128,128,.18))',
						strokeWidth: 1,
						strokeDasharray: i === 0 ? undefined : '3 5',
					}),
					h(
						'text',
						{
							key: `gt${i}`,
							x: pad.left - 8,
							y: y + 3.5,
							textAnchor: 'end',
							fill: 'var(--dsw-alias-label-tertiary, #8a8f98)',
							fontSize: 9.5,
						},
						money(value, 1),
					),
				);
			}

			const last = points[points.length - 1];
			const lastValue = rows[rows.length - 1].total;

			return h(
				'div',
				{ ref },
				h(
					'svg',
					{ className: 'dsb-chart', viewBox: `0 0 ${w} ${height}`, role: 'img' },
					h(
						'defs',
						null,
						h(
							'linearGradient',
							{ id: 'dsb-area', x1: '0', y1: '0', x2: '0', y2: '1' },
							h('stop', { offset: '0%', stopColor: '#4d6bfe', stopOpacity: 0.28 }),
							h('stop', { offset: '100%', stopColor: '#4d6bfe', stopOpacity: 0 }),
						),
					),
					...gridlines,
					h('path', { d: area, fill: 'url(#dsb-area)' }),
					h('path', {
						d: path,
						fill: 'none',
						stroke: 'var(--dsw-alias-state-business-primary, #5b8cff)',
						strokeWidth: 2,
						strokeLinecap: 'round',
						strokeLinejoin: 'round',
					}),
					h('circle', { cx: last[0], cy: last[1], r: 9, fill: '#3ddc97', opacity: 0.16 }),
					h('circle', {
						cx: last[0],
						cy: last[1],
						r: 3.6,
						fill: '#3ddc97',
						stroke: 'var(--dsw-alias-bg-base, #fff)',
						strokeWidth: 1.6,
					}),
					h(
						'text',
						{
							x: last[0] - 6,
							y: last[1] - 12,
							textAnchor: 'end',
							fill: 'var(--dsw-alias-label-primary, currentColor)',
							fontSize: 10.5,
							fontWeight: 600,
						},
						`${sign}${money(lastValue)}`,
					),
					h(
						'text',
						{
							x: pad.left,
							y: height - 5,
							textAnchor: 'start',
							fill: 'var(--dsw-alias-label-tertiary, #8a8f98)',
							fontSize: 9.5,
						},
						stampOf(t0),
					),
					h(
						'text',
						{
							x: pad.left + innerW,
							y: height - 5,
							textAnchor: 'end',
							fill: 'var(--dsw-alias-label-tertiary, #8a8f98)',
							fontSize: 9.5,
						},
						stampOf(t1),
					),
				),
			);
		}

		/* ---------------------------------------------------------- Token 趋势 */

		const TOKEN_GRANULARITIES = [
			{ key: 'day', label: '按天' },
			{ key: 'week', label: '按周' },
			{ key: 'month', label: '按月' },
		];

		const TOKEN_BAR_HEIGHT = 150;

		/**
		 * 堆叠柱状图：缓存命中 / 输入 / 输出。
		 * @param usage - Host 返回的 usage 快照。
		 * @param granularity - day | week | month。
		 */
		function TokenTrend({ usage, granularity }) {
			const [hover, setHover] = React.useState(-1);
			const group = usage && usage[granularity];
			const buckets = (group && group.buckets) || [];
			const hasData = buckets.some((bucket) => bucket.total > 0);

			if (!hasData) {
				return h(
					'div',
					{ className: 'dsb-empty' },
					h('div', null, usage && usage.available === false ? '还没有 token 使用记录' : '正在统计 token 用量'),
					h('div', { style: { opacity: 0.75 } }, '数据来自本机会话日志 ~/.dsh/sessions，跑过一轮对话就会出现'),
				);
			}

			const max = Math.max(...buckets.map((bucket) => bucket.total), 1);
			const labelEvery = Math.max(1, Math.ceil(buckets.length / 6));
			const active = hover >= 0 ? buckets[hover] : buckets[buckets.length - 1];
			const segments = (bucket) => [
				{ kind: 'cache', value: bucket.cacheRead + (bucket.cacheWrite || 0) },
				{ kind: 'input', value: bucket.input },
				{ kind: 'output', value: bucket.output },
			];

			return h(
				'div',
				null,
				h(
					'div',
					{ className: 'dsb-bars' },
					buckets.map((bucket, index) =>
						h(
							'div',
							{
								key: bucket.key,
								className: 'dsb-bar',
								'data-hover': String(index === hover),
								onMouseEnter: () => setHover(index),
								onMouseLeave: () => setHover(-1),
								title: `${bucket.label}：合计 ${tokens(bucket.total)}`,
							},
							segments(bucket).map((segment) =>
								h('div', {
									key: segment.kind,
									className: 'dsb-bar-seg',
									'data-kind': segment.kind,
									style: {
										height: `${bucket.total > 0 ? Math.max(1, Math.round((segment.value / max) * TOKEN_BAR_HEIGHT)) : 0}px`,
									},
								}),
							),
						),
					),
				),
				h(
					'div',
					{ className: 'dsb-bars-axis' },
					buckets.map((bucket, index) =>
						h(
							'span',
							{ key: bucket.key },
							index % labelEvery === 0 || index === buckets.length - 1 ? bucket.label : '',
						),
					),
				),
				h(
					'div',
					{ className: 'dsb-chart-foot' },
					h(
						'span',
						null,
						active
							? h(
									'span',
									null,
									`峰值 `,
									h('b', null, tokens(max)),
									` · ${active.label} · 合计 `,
									h('b', null, tokens(active.total)),
									` · 缓存 `,
									h('b', null, tokens(active.cacheRead)),
									` · 输入 `,
									h('b', null, tokens(active.input)),
									` · 输出 `,
									h('b', null, tokens(active.output)),
									` · ${active.requests} 次`,
								)
							: '',
					),
					h(
						'span',
						{ className: 'dsb-legend' },
						h('span', null, h('i', { 'data-kind': 'cache' }), '缓存命中'),
						h('span', null, h('i', { 'data-kind': 'input' }), '输入'),
						h('span', null, h('i', { 'data-kind': 'output' }), '输出'),
					),
				),
			);
		}

		/* ---------------------------------------------------------- 页面 */

		const RANGES = [
			{ key: '1', label: '24 小时', days: 1 },
			{ key: '7', label: '7 天', days: 7 },
			{ key: '30', label: '30 天', days: 30 },
			{ key: '0', label: '全部', days: 0 },
		];

		const TOKEN_STORAGE_KEY = 'dsh-plugin-deepseek-balance/token-granularity';

		function BalanceSection() {
			const { status, data, error, reload } = useSummary();
			const [range, setRange] = React.useState('7');
			const [budgetDraft, setBudgetDraft] = React.useState(null);
			const budgetTimer = React.useRef(null);
			const [tokenGranularity, setTokenGranularity] = React.useState(() => {
				try {
					const saved = window.localStorage.getItem(TOKEN_STORAGE_KEY);
					if (saved === 'day' || saved === 'week' || saved === 'month') return saved;
				} catch {
					/* 隐私模式下忽略 */
				}
				return 'day';
			});

			const balance = data && data.balance;
			const currency = (balance && balance.currency) || 'CNY';
			const sign = signOf(currency);
			const budget = (data && data.budget) || 100;
			const hasBalance = Boolean(balance) && Number.isFinite(balance.total);
			const stats = (data && data.stats) || {};
			const history = (data && data.history) || [];

			const usage = (data && data.usage) || null;
			const usageTotals = (usage && usage.totals) || { input: 0, output: 0, cacheRead: 0, total: 0, requests: 0 };
			const hitRate = usage && typeof usage.cacheHitRate === 'number' ? usage.cacheHitRate : 0;
			const lastTokenBucket = (granularity) => {
				const group = usage && usage[granularity];
				const list = (group && group.buckets) || [];
				return list.length ? list[list.length - 1] : null;
			};
			const todayUsage = lastTokenBucket('day');
			const weekUsage = lastTokenBucket('week');
			const monthUsage = lastTokenBucket('month');

			function changeTokenGranularity(key) {
				setTokenGranularity(key);
				try {
					window.localStorage.setItem(TOKEN_STORAGE_KEY, key);
				} catch {
					/* 隐私模式下忽略 */
				}
			}

			const activeRange = RANGES.find((item) => item.key === range) || RANGES[1];
			const cutoff = activeRange.days ? Date.now() - activeRange.days * 86_400_000 : 0;
			const rows = history.filter((row) => row.t >= cutoff);

			const liveState = error ? 'error' : data && data.stale ? 'stale' : 'ok';

			function commitBudget(value) {
				const next = Number(value);
				if (!Number.isFinite(next) || next <= 0) return;
				if (budgetTimer.current) clearTimeout(budgetTimer.current);
				budgetTimer.current = setTimeout(() => {
					fetch('/api/deepseek-balance/budget', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ budget: next }),
					}).then(() => reload());
				}, 450);
			}

			React.useEffect(() => () => {
				if (budgetTimer.current) clearTimeout(budgetTimer.current);
			}, []);

			const okState = balance ? balance.isAvailable : null;
			const change = Number(stats.change) || 0;

			return h(
				'div',
				{ className: 'dsb-root' },
				// 标题
				h(
					'div',
					{ className: 'dsb-head' },
					h(
						'div',
						null,
						h('div', { className: 'dsb-title' }, 'DeepSeek 余额'),
						h(
							'div',
							{ className: 'dsb-sub' },
							data && data.fetchedAt
								? `最近同步 ${timeOf(Date.parse(data.fetchedAt))} · 每 60 秒自动刷新`
								: '正在连接余额接口…',
						),
					),
					h(
						'div',
						{ className: 'dsb-actions' },
						h(
							'span',
							{ className: 'dsb-live', 'data-state': liveState },
							h('span', { className: 'dsb-dot' }),
							liveState === 'ok' ? '实时' : liveState === 'stale' ? '缓存数据' : '连接失败',
						),
						h(
							'button',
							{
								type: 'button',
								className: 'dsb-btn',
								disabled: status === 'loading',
								onClick: () => reload(),
							},
							status === 'loading' ? '刷新中…' : '刷新',
						),
					),
				),

				// 错误提示
				data && data.error
					? h('div', { className: 'dsb-note' }, data.error.message || '余额接口暂时不可用')
					: error
						? h('div', { className: 'dsb-note' }, `无法连接本地服务：${error}`)
						: null,

				// 主卡
				h(
					'div',
					{ className: 'dsb-card' },
					h(
						'div',
						{ className: 'dsb-hero' },
						h(
							'div',
							null,
							h(Gauge, { total: hasBalance ? balance.total : 0, budget, hasBalance, sign }),
							h(
								'div',
								{ className: 'dsb-budget' },
								'月度预算',
								h('input', {
									type: 'number',
									min: '1',
									step: '10',
									value: budgetDraft === null ? String(budget) : budgetDraft,
									onChange: (event) => {
										setBudgetDraft(event.target.value);
										commitBudget(event.target.value);
									},
									onBlur: () => setBudgetDraft(null),
								}),
							),
						),
						h(
							'div',
							{ className: 'dsb-stats' },
							h(
								'div',
								{ className: 'dsb-stat' },
								h('div', { className: 'dsb-stat-label' }, '充值余额'),
								h('div', { className: 'dsb-stat-value' }, hasBalance ? `${sign}${money(balance.toppedUp)}` : '—'),
							),
							h(
								'div',
								{ className: 'dsb-stat' },
								h('div', { className: 'dsb-stat-label' }, '赠送余额'),
								h(
									'div',
									{ className: 'dsb-stat-value dsb-accent' },
									hasBalance ? `${sign}${money(balance.granted)}` : '—',
								),
							),
							h(
								'div',
								{ className: 'dsb-stat' },
								h('div', { className: 'dsb-stat-label' }, '账户状态'),
								h(
									'div',
									{
										className: 'dsb-status dsb-stat-value',
										'data-ok': okState === true ? 'true' : okState === false ? 'false' : 'unknown',
									},
									h('i'),
									h('span', null, okState === true ? '正常可用' : okState === false ? '已欠费' : '未知'),
								),
							),
							h(
								'div',
								{ className: 'dsb-stat' },
								h('div', { className: 'dsb-stat-label' }, '近 7 天日均消耗'),
								h(
									'div',
									{ className: 'dsb-stat-value' },
									`${sign}${money(Number(stats.dailyBurn) || 0)}`,
								),
							),
						),
					),
				),

				// 余额趋势（消耗指标与数据说明一起放进这张卡）
				h(
					'div',
					{ className: 'dsb-card' },
					h(
						'div',
						{ className: 'dsb-chart-head' },
						h('div', { className: 'dsb-chart-title' }, '余额趋势'),
						h(
							'div',
							{ className: 'dsb-seg' },
							RANGES.map((item) =>
								h(
									'button',
									{
										key: item.key,
										type: 'button',
										'data-active': String(item.key === range),
										onClick: () => setRange(item.key),
									},
									item.label,
								),
							),
						),
					),
					h(Trend, { rows, sign }),
					// 消耗指标
					h(
						'div',
						{ className: 'dsb-metrics', style: { marginTop: 14 } },
						h(
							'div',
							{ className: 'dsb-metric' },
							h('div', { className: 'dsb-metric-label' }, '预计可用天数'),
							h(
								'div',
								{ className: 'dsb-metric-value' },
								stats.daysLeft === null || stats.daysLeft === undefined
									? Number(stats.dailyBurn) > 0
										? '—'
										: '充足'
									: `${stats.daysLeft} 天`,
							),
							h(
								'div',
								{ className: 'dsb-metric-sub' },
								Number(stats.dailyBurn) > 0 ? '按当前消耗速度推算' : '暂无明显消耗',
							),
						),
						h(
							'div',
							{ className: 'dsb-metric' },
							h('div', { className: 'dsb-metric-label' }, '窗口内变化'),
							h(
								'div',
								{
									className: `dsb-metric-value${change < 0 ? ' dsb-neg' : change > 0 ? ' dsb-pos' : ''}`,
								},
								`${change > 0 ? '+' : change < 0 ? '−' : ''}${sign}${money(Math.abs(change))}`,
							),
							h('div', { className: 'dsb-metric-sub' }, `最近 ${stats.points || 0} 个采样点`),
						),
						h(
							'div',
							{ className: 'dsb-metric' },
							h('div', { className: 'dsb-metric-label' }, '采样覆盖'),
							h('div', { className: 'dsb-metric-value' }, durationOf(stats.spanHours)),
							h('div', { className: 'dsb-metric-sub' }, '服务端每 60 秒采样一次'),
						),
						h(
							'div',
							{ className: 'dsb-metric' },
							h('div', { className: 'dsb-metric-label' }, '预算剩余'),
							h(
								'div',
								{ className: 'dsb-metric-value' },
								hasBalance && budget > 0 ? `${((balance.total / budget) * 100).toFixed(1)}%` : '—',
							),
							h('div', { className: 'dsb-metric-sub' }, `预算 ${sign}${money(budget, 0)}`),
						),
					),
					h(
						'div',
						{ className: 'dsb-foot', style: { marginTop: 12 } },
						'余额来自 DeepSeek /user/balance；Token 用量来自本机会话日志 ~/.dsh/sessions。API Key 只在本地 Host 进程中使用，不会下发到浏览器。',
					),
				),

				// Token 使用趋势（放在最下方）
				h(
					'div',
					{ className: 'dsb-card' },
					h(
						'div',
						{ className: 'dsb-chart-head' },
						h('div', { className: 'dsb-chart-title' }, 'Token 使用趋势'),
						h(
							'div',
							{ className: 'dsb-seg' },
							TOKEN_GRANULARITIES.map((item) =>
								h(
									'button',
									{
										key: item.key,
										type: 'button',
										'data-active': String(item.key === tokenGranularity),
										onClick: () => changeTokenGranularity(item.key),
									},
									item.label,
								),
							),
						),
					),
					h(TokenTrend, { usage, granularity: tokenGranularity }),
					h(
						'div',
						{ className: 'dsb-metrics', style: { marginTop: 14 } },
						h(
							'div',
							{ className: 'dsb-metric' },
							h('div', { className: 'dsb-metric-label' }, '今日'),
							h('div', { className: 'dsb-metric-value' }, tokens(todayUsage ? todayUsage.total : 0)),
							h('div', { className: 'dsb-metric-sub' }, todayUsage ? `${todayUsage.requests} 次请求` : '暂无记录'),
						),
						h(
							'div',
							{ className: 'dsb-metric' },
							h('div', { className: 'dsb-metric-label' }, '本周'),
							h('div', { className: 'dsb-metric-value' }, tokens(weekUsage ? weekUsage.total : 0)),
							h(
								'div',
								{ className: 'dsb-metric-sub' },
								weekUsage ? `未命中缓存 ${tokens(weekUsage.input + weekUsage.output)}` : '暂无记录',
							),
						),
						h(
							'div',
							{ className: 'dsb-metric' },
							h('div', { className: 'dsb-metric-label' }, '本月'),
							h('div', { className: 'dsb-metric-value' }, tokens(monthUsage ? monthUsage.total : 0)),
							h('div', { className: 'dsb-metric-sub' }, monthUsage ? `${monthUsage.requests} 次请求` : '暂无记录'),
						),
						h(
							'div',
							{ className: 'dsb-metric' },
							h('div', { className: 'dsb-metric-label' }, '缓存命中率'),
							h('div', { className: 'dsb-metric-value' }, `${(hitRate * 100).toFixed(1)}%`),
							h('div', { className: 'dsb-metric-sub' }, `累计 ${tokens(usageTotals.total)} tokens`),
						),
					),
				),
			);
		}

		/* ---------------------------------------------------------- 注册 */

		/** 只依赖 UI 插槽服务。 */
		const inject = ['slots'];

		/**
		 * 在设置里挂一个「余额」分区。
		 * @param ctx - 浏览器端 Cordis 上下文。
		 */
		function apply(ctx) {
			ctx.slots.inject('settings.section', () =>
				ctx.slots.register(
					{
						name: 'settings.section',
						id: 'deepseek-balance',
						order: 35,
						label: () => '余额',
					},
					BalanceSection,
				),
			);
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	},
});
