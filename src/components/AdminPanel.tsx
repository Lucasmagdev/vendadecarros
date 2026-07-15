import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Database,
  Loader2,
  Maximize2,
  Plus,
  QrCode,
  RefreshCcw,
  Search,
  Smartphone,
  UploadCloud,
} from 'lucide-react';
import { inventoryVehicles } from '../data/inventory';
import {
  connectEvolutionInstance,
  createEvolutionInstance,
  EvolutionConnectResult,
  EvolutionStatusResult,
  getEvolutionStatus,
} from '../services/evolutionApi';
import { InventoryVehicle } from '../types';

const statusConfig: Record<InventoryVehicle['status'], { label: string; className: string }> = {
  disponivel: { label: 'Disponível', className: 'bg-emerald-400/10 text-emerald-200' },
  reservado: { label: 'Reservado', className: 'bg-amber-400/10 text-amber-200' },
  vendido: { label: 'Vendido', className: 'bg-slate-500/15 text-slate-300' },
  revisao: { label: 'Em revisão', className: 'bg-cyan-400/10 text-cyan-200' },
};

function getConnectionState(status: EvolutionStatusResult | null): string {
  const evolution = status?.evolution as { instance?: { state?: string } } | undefined;
  return evolution?.instance?.state || 'desconhecido';
}

export default function AdminPanel() {
  const [status, setStatus] = useState<EvolutionStatusResult | null>(null);
  const [connection, setConnection] = useState<EvolutionConnectResult | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [qrIssuedAt, setQrIssuedAt] = useState<number | null>(null);
  const qrImage = getQrImage(connection);
  const connectionState = getConnectionState(status);
  const isConnected = connectionState === 'open';

  const inventoryStats = useMemo(() => {
    const available = inventoryVehicles.filter((vehicle) => vehicle.status === 'disponivel').length;
    const reserved = inventoryVehicles.filter((vehicle) => vehicle.status === 'reservado').length;
    const review = inventoryVehicles.filter((vehicle) => vehicle.status === 'revisao').length;
    return { total: inventoryVehicles.length, available, reserved, review };
  }, []);

  const refreshStatus = async () => {
    setIsLoadingStatus(true);
    try {
      setStatus(await getEvolutionStatus());
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleCreateInstance = async () => {
    setIsCreating(true);
    try {
      setConnection(await createEvolutionInstance({ instanceName: 'loja-whatsapp' }));
      await refreshStatus();
    } finally {
      setIsCreating(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      setConnection(await connectEvolutionInstance());
      setQrIssuedAt(Date.now());
      await refreshStatus();
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    // Status ao vivo a cada 8s.
    const statusInterval = setInterval(refreshStatus, 8_000);
    return () => clearInterval(statusInterval);
  }, []);

  // QR do WhatsApp expira em ~40s — renova sozinho enquanto houver QR na tela e não estiver conectado.
  useEffect(() => {
    if (!connection || isConnected) return;
    const qrInterval = setInterval(async () => {
      try {
        setConnection(await connectEvolutionInstance());
        setQrIssuedAt(Date.now());
      } catch {
        // tenta no próximo ciclo
      }
    }, 30_000);
    return () => clearInterval(qrInterval);
  }, [connection, isConnected]);

  return (
    <main className="px-6 py-5">
      <section className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-gold">Administração</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-50">Painel da loja</h2>
          <p className="mt-1 text-sm text-slate-400">WhatsApp, regras da IA e estoque em uma tela só.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-navy-900/60 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-gold/40 hover:text-gold">
            <UploadCloud size={16} />
            Importar estoque
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-navy-950 transition hover:bg-gold-light">
            <Plus size={16} />
            Novo veículo
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <aside className="space-y-4">
          <WhatsAppCard
            status={status}
            connection={connection}
            isConnected={isConnected}
            qrImage={qrImage}
            qrIssuedAt={qrIssuedAt}
            isLoadingStatus={isLoadingStatus}
            isCreating={isCreating}
            isConnecting={isConnecting}
            onRefresh={refreshStatus}
            onCreate={handleCreateInstance}
            onConnect={handleConnect}
          />
          <AutomationCard />
        </aside>

        <section className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryCard label="Veículos" value={inventoryStats.total} />
            <SummaryCard label="Disponíveis" value={inventoryStats.available} />
            <SummaryCard label="Reservados" value={inventoryStats.reserved} />
            <SummaryCard label="Em revisão" value={inventoryStats.review} />
          </div>

          <div className="grid gap-4 2xl:grid-cols-[1fr_360px]">
            <InventoryTable />
            <VehicleEditor />
          </div>
        </section>
      </section>
    </main>
  );
}

const QR_TTL_SECONDS = 30;

function useQrCountdown(qrIssuedAt: number | null, active: boolean): number {
  const [remaining, setRemaining] = useState(QR_TTL_SECONDS);

  useEffect(() => {
    if (!active || !qrIssuedAt) return;
    const update = () =>
      setRemaining(Math.max(0, QR_TTL_SECONDS - Math.floor((Date.now() - qrIssuedAt) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [qrIssuedAt, active]);

  return remaining;
}

function QrCountdownBar({ remaining }: { remaining: number }) {
  const pct = (remaining / QR_TTL_SECONDS) * 100;
  const urgent = remaining <= 8;
  return (
    <div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-950/70">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            urgent ? 'bg-rose-400' : 'bg-emerald-400'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`mt-1 text-center text-[10px] font-semibold ${urgent ? 'text-rose-300' : 'text-slate-500'}`}>
        {remaining > 0 ? `QR renova em ${remaining}s` : 'Renovando QR...'}
      </p>
    </div>
  );
}

function ScanSteps() {
  const steps = [
    'Abra o WhatsApp Business no celular da loja',
    'Toque em ⋮ (menu) > Aparelhos conectados',
    'Toque em "Conectar aparelho" e aponte para o QR',
  ];
  return (
    <ol className="space-y-1.5">
      {steps.map((step, index) => (
        <li key={step} className="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
          <span className="mt-px grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/15 text-[10px] font-bold text-gold">
            {index + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}

function WhatsAppCard({
  status,
  connection,
  isConnected,
  qrImage,
  qrIssuedAt,
  isLoadingStatus,
  isCreating,
  isConnecting,
  onRefresh,
  onCreate,
  onConnect,
}: {
  status: EvolutionStatusResult | null;
  connection: EvolutionConnectResult | null;
  isConnected: boolean;
  qrImage: string | null;
  qrIssuedAt: number | null;
  isLoadingStatus: boolean;
  isCreating: boolean;
  isConnecting: boolean;
  onRefresh: () => void;
  onCreate: () => void;
  onConnect: () => void;
}) {
  const [zoomOpen, setZoomOpen] = useState(false);
  const qrActive = Boolean(connection) && !isConnected;
  const remaining = useQrCountdown(qrIssuedAt, qrActive);

  useEffect(() => {
    if (isConnected) setZoomOpen(false);
  }, [isConnected]);

  return (
    <section className="rounded-lg border border-slate-800 bg-navy-900/35 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-gold" />
          <h3 className="font-bold text-slate-100">WhatsApp da loja</h3>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold ${
            isConnected
              ? 'bg-emerald-400/15 text-emerald-200'
              : qrActive
                ? 'bg-amber-400/10 text-amber-200'
                : 'bg-slate-500/15 text-slate-300'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isConnected ? 'bg-emerald-400' : qrActive ? 'animate-pulse bg-amber-400' : 'bg-slate-500'
            }`}
          />
          {isConnected ? 'Conectado' : qrActive ? 'Aguardando leitura' : 'Desconectado'}
        </span>
      </div>

      {isConnected ? (
        <div className="animate-card-in rounded-lg border border-emerald-400/25 bg-emerald-400/5 p-4 text-center">
          <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
          <p className="mt-2 text-sm font-bold text-emerald-200">WhatsApp conectado</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            Mensagens da instância <span className="text-slate-300">{status?.instance || 'loja-whatsapp'}</span> entram
            direto no pipeline. A IA já está atendendo.
          </p>
        </div>
      ) : qrActive ? (
        <div className="animate-card-in">
          <button
            onClick={() => setZoomOpen(true)}
            title="Ampliar QR Code"
            className="group relative mx-auto block w-full max-w-[210px] rounded-xl bg-white p-3 shadow-lg shadow-black/30 transition hover:scale-[1.02]"
          >
            {qrImage ? (
              <img src={qrImage} alt="QR Code WhatsApp" className="aspect-square w-full object-contain" />
            ) : (
              <DemoQrCode />
            )}
            <span className="absolute bottom-2 right-2 grid h-7 w-7 place-items-center rounded-md bg-navy-950/80 text-slate-200 opacity-0 transition group-hover:opacity-100">
              <Maximize2 size={14} />
            </span>
          </button>
          <div className="mx-auto mt-2 max-w-[210px]">
            <QrCountdownBar remaining={remaining} />
          </div>
          <div className="mt-3 rounded-lg border border-slate-800 bg-navy-950/40 p-3">
            <ScanSteps />
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-700 bg-navy-950/30 p-5 text-center">
          <QrCode size={40} className="mx-auto text-slate-600" />
          <p className="mt-2 text-sm font-semibold text-slate-300">Conecte o WhatsApp da loja</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Gere o QR Code e escaneie com o WhatsApp Business. Leva menos de um minuto.
          </p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {!isConnected && (
          <button
            onClick={onConnect}
            disabled={isConnecting}
            className="col-span-3 inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-3 py-2 text-sm font-bold text-navy-950 transition hover:bg-gold-light disabled:opacity-60"
          >
            {isConnecting ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
            {qrActive ? 'Gerar novo QR agora' : 'Gerar QR Code'}
          </button>
        )}
        <button
          onClick={onRefresh}
          disabled={isLoadingStatus}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-xs font-semibold text-slate-300 transition hover:border-gold/40 hover:text-gold disabled:opacity-60"
        >
          {isLoadingStatus ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
          Status
        </button>
        <button
          onClick={onCreate}
          disabled={isCreating}
          className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 px-2 py-2 text-xs font-semibold text-slate-300 transition hover:border-gold/40 hover:text-gold disabled:opacity-60"
        >
          {isCreating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          Criar instância
        </button>
      </div>

      {zoomOpen && qrActive && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-navy-950/90 p-6 backdrop-blur-sm"
          onClick={() => setZoomOpen(false)}
        >
          <div className="text-center">
            <p className="text-lg font-bold text-slate-50">Escaneie com o WhatsApp Business</p>
            <p className="mt-1 text-sm text-slate-400">Aparelhos conectados &gt; Conectar aparelho</p>
          </div>
          <div
            className="w-full max-w-[380px] rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {qrImage ? (
              <img src={qrImage} alt="QR Code WhatsApp ampliado" className="aspect-square w-full object-contain" />
            ) : (
              <DemoQrCode />
            )}
          </div>
          <div className="w-full max-w-[380px]" onClick={(e) => e.stopPropagation()}>
            <QrCountdownBar remaining={remaining} />
          </div>
          <button
            onClick={() => setZoomOpen(false)}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-gold/40 hover:text-gold"
          >
            Fechar
          </button>
        </div>
      )}
    </section>
  );
}

function AutomationCard() {
  const rules = [
    'Primeiro atendimento',
    'Fotos e ficha do carro',
    'Dados para financiamento',
    'Agendamento de visita',
    'Transferência para vendedor',
  ];

  return (
    <section className="rounded-lg border border-slate-800 bg-navy-900/35 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Bot size={16} className="text-gold" />
        <h3 className="font-bold text-slate-100">IA ativa</h3>
      </div>
      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule} className="flex items-center gap-2 text-sm text-slate-300">
            <CheckCircle2 size={14} className="text-emerald-300" />
            {rule}
          </div>
        ))}
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-navy-900/35 p-4">
      <p className="text-2xl font-bold text-slate-50">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{label}</p>
    </div>
  );
}

function InventoryTable() {
  return (
    <section className="rounded-lg border border-slate-800 bg-navy-900/35">
      <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database size={16} className="text-gold" />
            <h3 className="font-bold text-slate-100">Estoque</h3>
          </div>
          <p className="mt-1 text-xs text-slate-500">Base usada pela IA para responder disponibilidade e preço.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-navy-950/50 px-3 py-2">
          <Search size={15} className="text-slate-500" />
          <input className="w-56 bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600" placeholder="Buscar veículo..." />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Veículo</th>
              <th className="px-4 py-3 font-semibold">Preço</th>
              <th className="px-4 py-3 font-semibold">Km</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Origem</th>
              <th className="px-4 py-3 font-semibold">Destaques</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {inventoryVehicles.map((vehicle) => (
              <InventoryRow key={vehicle.id} vehicle={vehicle} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VehicleEditor() {
  return (
    <section className="rounded-lg border border-slate-800 bg-navy-900/35 p-4">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gold">Cadastro</p>
        <h3 className="mt-1 font-bold text-slate-100">Novo veículo</h3>
        <p className="mt-1 text-xs text-slate-500">Campos essenciais para a IA vender sem inventar informação.</p>
      </div>

      <div className="grid gap-3">
        <FormField label="Modelo" placeholder="Chevrolet Onix LTZ" />
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Ano" placeholder="2023/2024" />
          <FormField label="Preço" placeholder="R$ 82.900" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Km" placeholder="28.400 km" />
          <FormField label="Status" placeholder="Disponível" />
        </div>
        <FormField label="Destaques para IA" placeholder="Automático, único dono, IPVA pago" />
        <button className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gold px-3 py-2.5 text-sm font-bold text-navy-950 transition hover:bg-gold-light">
          <Plus size={16} />
          Salvar veículo
        </button>
      </div>
    </section>
  );
}

function InventoryRow({ vehicle }: { vehicle: InventoryVehicle }) {
  const status = statusConfig[vehicle.status];

  return (
    <tr className="text-sm text-slate-300">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={vehicle.image} alt={vehicle.model} className="h-12 w-16 rounded-md object-cover" loading="lazy" />
          <div>
            <p className="font-semibold text-slate-100">{vehicle.model}</p>
            <p className="text-xs text-slate-500">{vehicle.year}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 font-semibold text-gold">{vehicle.price}</td>
      <td className="px-4 py-3">{vehicle.mileage}</td>
      <td className="px-4 py-3">
        <span className={`rounded-md px-2 py-1 text-xs font-semibold ${status.className}`}>{status.label}</span>
      </td>
      <td className="px-4 py-3 uppercase text-slate-500">{vehicle.source}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {vehicle.highlights.slice(0, 2).map((highlight) => (
            <span key={highlight} className="rounded-md bg-navy-950/60 px-2 py-1 text-xs text-slate-300">
              {highlight}
            </span>
          ))}
        </div>
      </td>
    </tr>
  );
}

function FormField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-400">{label}</span>
      <input
        className="w-full rounded-lg border border-slate-700 bg-navy-950/60 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-gold/50"
        placeholder={placeholder}
      />
    </label>
  );
}

function getQrImage(connection: EvolutionConnectResult | null) {
  if (!connection) return null;

  const directQr = connection.qrcode?.base64;
  if (typeof directQr === 'string' && directQr) {
    return directQr.startsWith('data:') ? directQr : `data:image/png;base64,${directQr}`;
  }

  const evolution = connection.evolution;
  if (!evolution || typeof evolution !== 'object') return null;

  const maybeQr = evolution as {
    base64?: string;
    qrcode?: { base64?: string };
  };
  const nestedQr = maybeQr.base64 || maybeQr.qrcode?.base64;

  if (!nestedQr) return null;
  return nestedQr.startsWith('data:') ? nestedQr : `data:image/png;base64,${nestedQr}`;
}

function DemoQrCode() {
  const cells = [
    0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 21, 22, 23, 24, 25, 26,
    28, 31, 33, 36, 39, 42, 45, 49, 50, 54, 56, 57, 60, 62, 65, 67, 69, 72,
    75, 78, 80, 81, 84, 87, 89, 92, 94, 97, 100, 104, 106, 108, 111, 113,
    116, 120, 122, 124, 126, 127, 128, 129, 130, 131, 132, 136, 138, 141,
    143, 146, 150, 153, 156, 158, 161, 164, 166, 169, 172, 176, 178, 181,
    184, 186, 189, 192, 194, 197, 200, 204, 206, 208, 210, 211, 212, 213,
    214, 215, 216,
  ];

  return (
    <div className="grid h-full w-full grid-cols-[repeat(15,1fr)] gap-0.5">
      {Array.from({ length: 225 }).map((_, index) => (
        <div key={index} className={cells.includes(index) ? 'bg-slate-950' : 'bg-white'} />
      ))}
    </div>
  );
}
