import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  Activity, AlertCircle, ArrowRight, ArrowUpRight, Bell,
  BriefcaseBusiness, CalendarClock, Check, CheckCheck, CheckCircle2,
  ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, Clock3,
  CloudDownload, FileCheck2, FileSearch, FileText, Filter, FolderOpen,
  LayoutDashboard, ListTodo, BellRing, Building2, Mail, Play, Save, Users, 
  LoaderCircle, Menu, Plus, Radar, Search,
  Settings2, ShieldCheck, Sparkles, Target, Upload, Wallet, X,
  Eye, EyeOff, KeyRound, LockKeyhole, LogOut, UserRound, Phone, ArrowLeft,
} from 'lucide-react';

import * as Utils from '../../utils/licita360.js';
const { STORAGE_KEY, storageKeyForUser, todayISO, uid, fmtBRL, parseDate, formatDate, toDateTimeLocalValue, initialData, loadData, nav, statusOptions, normalizeSearchText, BRANCH_SYNONYMS, getBranchSearchTerms, findMatchingBranches, calculateProjectedProfit, UF_OPTIONS, csvValues, emptyPartnerDraft } = Utils;

function PrimaryButton({
  type = 'button',
  icon: Icon,
  children,
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      className={`button button-primary ${className}`.trim()}
      {...props}
    >
      {Icon && <Icon size={16} />}
      {children}
    </button>
  );
}

export function OpportunityModal({ initial, onClose, onSave }) {
  const [form, setForm] = useState(
    initial
      ? {
          ...initial,
          expectedRevenue: initial.expectedRevenue ?? '',
          estimatedCost: initial.estimatedCost ?? '',
          taxPercent: String(initial.taxPercent ?? '0'),
        }
      : {
          id: uid(),
          title: '',
          category: '',
          agency: '',
          location: 'CE',
          modality: 'Pregão eletrônico',
          amount: '',
          expectedRevenue: '',
          estimatedCost: '',
          taxPercent: '0',
          deadline: '',
          status: 'Em análise',
          source: 'Manual',
          url: '',
          tasks: [],
        }
  );

  const update = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = (event) => {
    event.preventDefault();

    onSave({
      ...form,
      deadline: form.deadline
        ? new Date(form.deadline).toISOString()
        : '',
    });
  };

  const deadlineValue = toDateTimeLocalValue(form.deadline);

  return (
    <Modal
      title={initial ? 'Editar oportunidade' : 'Cadastrar oportunidade'}
      subtitle="Organize os dados do edital e, quando disponível, a projeção financeira da sua proposta."
      onClose={onClose}
      wide
    >
      <form className="form-stack modal-form" onSubmit={submit}>
        <label>
          Objeto / título do edital
          <input
            required
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            placeholder="Ex.: Fornecimento de material de expediente"
          />
        </label>

        <label>
          Órgão / entidade
          <input
            required
            value={form.agency}
            onChange={(e) => update('agency', e.target.value)}
            placeholder="Nome do órgão público"
          />
        </label>

        <div className="form-grid">
          <label>
            Ramo / categoria
            <input
              required
              value={form.category}
              onChange={(e) => update('category', e.target.value)}
              placeholder="Ex.: Tecnologia"
            />
          </label>

          <label>
            Valor estimado do edital (R$)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => update('amount', e.target.value)}
              placeholder="0,00"
            />
          </label>

          <label>
            Receita prevista da sua proposta (R$)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.expectedRevenue ?? ''}
              onChange={(e) => update('expectedRevenue', e.target.value)}
              placeholder="Valor previsto de recebimento"
            />
            <small>
              Use o valor da proposta da empresa, não necessariamente o valor
              máximo do edital.
            </small>
          </label>

          <label>
            Custo total previsto (R$)
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.estimatedCost ?? ''}
              onChange={(e) => update('estimatedCost', e.target.value)}
              placeholder="Compra, execução e despesas"
            />
            <small>
              Inclua custos de compra ou execução, frete e despesas indiretas.
            </small>
          </label>

          <label>
            Tributos estimados (%)
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.taxPercent ?? '0'}
              onChange={(e) => update('taxPercent', e.target.value)}
            />
          </label>

          <label>
            Estado (UF)
            <select
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
            >
              {'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'
                .split(' ')
                .map((uf) => (
                  <option key={uf}>{uf}</option>
                ))}
            </select>
          </label>

          <label>
            Modalidade
            <select
              value={form.modality}
              onChange={(e) => update('modality', e.target.value)}
            >
              <option>Pregão eletrônico</option>
              <option>Concorrência eletrônica</option>
              <option>Dispensa de licitação</option>
              <option>Inexigibilidade</option>
              <option>Credenciamento</option>
              <option>Leilão eletrônico</option>
              <option>Outra</option>
            </select>
          </label>

          <label>
            Prazo / sessão
            <input
              type="datetime-local"
              value={deadlineValue}
              onChange={(e) => update('deadline', e.target.value)}
            />
          </label>

          <label>
            Etapa atual
            <select
              value={form.status}
              onChange={(e) => update('status', e.target.value)}
            >
              {statusOptions.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Link do edital ou da fonte (opcional)
          <input
            type="url"
            value={form.url || ''}
            onChange={(e) => update('url', e.target.value)}
            placeholder="https://..."
          />
        </label>

        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>

          <PrimaryButton type="submit" icon={Check}>
            {initial ? 'Salvar alterações' : 'Adicionar ao radar'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export function TaskModal({ opportunities, onClose, onSave }) {
  const [form, setForm] = useState({
    title: '',
    date: todayISO(),
    priority: 'Média',
    linked: '',
  });

  const submit = (event) => {
    event.preventDefault();
    onSave(form);
  };

  return (
    <Modal
      title="Nova tarefa"
      subtitle="Defina a próxima ação e a data para realizá-la."
      onClose={onClose}
    >
      <form className="form-stack modal-form" onSubmit={submit}>
        <label>
          O que precisa ser feito?
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Ex.: Conferir certidões"
          />
        </label>

        <label>
          Data limite
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </label>

        <label>
          Prioridade
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option>Baixa</option>
            <option>Média</option>
            <option>Alta</option>
          </select>
        </label>

        <label>
          Vincular a um processo (opcional)
          <select
            value={form.linked}
            onChange={(e) => setForm({ ...form, linked: e.target.value })}
          >
            <option value="">Sem vínculo</option>
            {opportunities.map((item) => (
              <option value={item.id} key={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </label>

        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>

          <PrimaryButton type="submit" icon={Plus}>
            Criar tarefa
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}

export function SettingsModal({ profile, onClose, onSave, onReset }) {
  const [company, setCompany] = useState(profile.company || 'Minha empresa');
  const [branches, setBranches] = useState((profile.branches || []).join(', '));
  const [uf, setUf] = useState(profile.uf || 'CE');

  const submit = (event) => {
    event.preventDefault();

    onSave({
      company: company.trim() || 'Minha empresa',
      branches: [
        ...new Set(
          branches.split(',').map((branch) => branch.trim()).filter(Boolean)
        ),
      ],
      uf,
    });
  };

  return (
    <Modal
      title="Configurações da empresa"
      subtitle="Personalize o ambiente da empresa e os ramos usados no filtro do Radar."
      onClose={onClose}
    >
      <form className="form-stack modal-form" onSubmit={submit}>
        <label>
          Nome da empresa
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            required
          />
        </label>

        <label>
          Ramos de atuação
          <span className="field-help">
            Separe os ramos por vírgula. Ex.: Informática, Material de expediente,
            Alimentos.
          </span>
          <textarea
            value={branches}
            onChange={(e) => setBranches(e.target.value)}
            rows="4"
            placeholder="Tecnologia, materiais, serviços..."
          />
        </label>

        <label>
          Estado principal
          <select value={uf} onChange={(e) => setUf(e.target.value)}>
            {'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'
              .split(' ')
              .map((item) => (
                <option key={item}>{item}</option>
              ))}
          </select>
        </label>

        <div className="modal-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
          >
            Cancelar
          </button>

          <PrimaryButton type="submit" icon={Check}>
            Salvar
          </PrimaryButton>
        </div>

        <div className="reset-area">
          <button type="button" className="text-danger" onClick={onReset}>
            Restaurar dados de demonstração
          </button>
          <span>Faça backup antes de substituir dados existentes.</span>
        </div>
      </form>
    </Modal>
  );
}

export function HelpModal({ onClose }) {
  return (
    <Modal
      title="Sobre o Licita360"
      subtitle="Central de inteligência e gestão de licitações."
      onClose={onClose}
    >
      <div className="help-content">
        <div className="help-feature">
          <div><Radar size={20} /></div>
          <p>
            <strong>Radar e PNCP</strong>
            <br />
            Consulte oportunidades publicadas no PNCP e filtre os resultados
            pelos ramos cadastrados.
          </p>
        </div>

        <div className="help-feature">
          <div><FileCheck2 size={20} /></div>
          <p>
            <strong>Dados e documentos</strong>
            <br />
            Os metadados são enviados à API e armazenados no PostgreSQL.
            O arquivo físico ainda não é enviado nesta versão.
          </p>
        </div>

        <div className="help-feature">
          <div><Wallet size={20} /></div>
          <p>
            <strong>Preço simulado</strong>
            <br />
            A calculadora é um apoio e não substitui análise tributária e de custos.
          </p>
        </div>

        <div className="inline-alert price-warning">
          <AlertCircle size={17} />
          <span>
            O armazenamento físico de arquivos, a análise de PDFs por IA e a automação
            de lances ainda precisam ser implementados.
          </span>
        </div>

        <button
          className="button button-primary full-button"
          onClick={onClose}
        >
          Entendi
        </button>
      </div>
    </Modal>
  );
}

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKey);

    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`modal ${wide ? 'modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>

          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
