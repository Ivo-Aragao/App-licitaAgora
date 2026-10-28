import React, { useMemo, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  FileText,
  Info,
  LoaderCircle,
  Plus,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import './EdictAnalyzerPage.css';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_PAGES = 150;
const MAX_TEXT_LENGTH = 1_500_000;

const RULES = [
  {
    id: 'proposal-deadline',
    title: 'Prazo de envio e sessão pública',
    group: 'Prazos',
    priority: 'Alta',
    terms: ['recebimento das propostas', 'abertura da sessão', 'sessão pública', 'sessao publica', 'data de abertura', 'prazo para envio da proposta', 'envio das propostas', 'data limite para apresentação'],
    guidance: 'Confirme a data, o horário, o fuso, a plataforma e o limite para enviar a proposta.',
  },
  {
    id: 'clarifications',
    title: 'Esclarecimentos e impugnação',
    group: 'Prazos',
    priority: 'Alta',
    terms: ['pedido de esclarecimento', 'pedidos de esclarecimento', 'impugnação do edital', 'impugnacao do edital', 'prazo para impugnação', 'prazo para impugnacao'],
    guidance: 'Anote os prazos para pedir esclarecimentos ou impugnar cláusulas e confirme o canal oficial.',
  },
  {
    id: 'legal-docs',
    title: 'Habilitação jurídica',
    group: 'Habilitação',
    priority: 'Alta',
    terms: ['habilitação jurídica', 'habilitacao juridica', 'contrato social', 'ato constitutivo', 'registro comercial'],
    guidance: 'Confira quais atos constitutivos, alterações e documentos de representação são exigidos.',
  },
  {
    id: 'fiscal-docs',
    title: 'Regularidade fiscal e trabalhista',
    group: 'Habilitação',
    priority: 'Alta',
    terms: ['regularidade fiscal', 'fazenda federal', 'fazenda estadual', 'fazenda municipal', 'fgts', 'cndt', 'certidão negativa', 'certidao negativa'],
    guidance: 'Compare cada certidão exigida com os documentos da empresa e suas datas de validade.',
  },
  {
    id: 'technical-qualification',
    title: 'Qualificação técnica',
    group: 'Habilitação',
    priority: 'Alta',
    terms: ['qualificação técnica', 'qualificacao tecnica', 'atestado de capacidade técnica', 'atestado de capacidade tecnica', 'conselho profissional', 'registro profissional', 'responsável técnico', 'responsavel tecnico'],
    guidance: 'Verifique atestados, registros, responsáveis técnicos e quantitativos mínimos exigidos.',
  },
  {
    id: 'financial-qualification',
    title: 'Qualificação econômico-financeira',
    group: 'Habilitação',
    priority: 'Alta',
    terms: ['qualificação econômico-financeira', 'qualificacao economico-financeira', 'balanço patrimonial', 'balanco patrimonial', 'índices contábeis', 'indices contabeis', 'capital mínimo', 'capital minimo'],
    guidance: 'Confirme balanços, índices, patrimônio líquido ou capital mínimo e o período exigido.',
  },
  {
    id: 'guarantee',
    title: 'Garantia de proposta ou contratual',
    group: 'Condições comerciais',
    priority: 'Alta',
    terms: ['garantia de proposta', 'garantia contratual', 'garantia de execução', 'seguro-garantia', 'seguro garantia', 'caução'],
    guidance: 'Identifique a modalidade, o percentual, o momento de apresentação e o prazo de validade da garantia.',
  },
  {
    id: 'sample',
    title: 'Amostra, prova de conceito ou catálogo',
    group: 'Requisitos técnicos',
    priority: 'Média',
    terms: ['apresentação de amostra', 'apresentacao de amostra', 'prova de conceito', 'catálogo técnico', 'catalogo tecnico', 'avaliação de amostra', 'avaliacao de amostra'],
    guidance: 'Confirme o que deve ser entregue, o prazo, o endereço, os critérios de avaliação e quem suporta o custo.',
  },
  {
    id: 'site-visit',
    title: 'Visita técnica ou vistoria',
    group: 'Requisitos técnicos',
    priority: 'Média',
    terms: ['visita técnica', 'visita tecnica', 'vistoria técnica', 'vistoria tecnica', 'atestado de visita'],
    guidance: 'Verifique se a visita é obrigatória, como agendar e quais declarações podem substituí-la.',
  },
  {
    id: 'delivery',
    title: 'Entrega, execução e local de atendimento',
    group: 'Execução',
    priority: 'Alta',
    terms: ['prazo de entrega', 'local de entrega', 'condições de entrega', 'condicoes de entrega', 'ordem de fornecimento', 'prazo de execução', 'prazo de execucao', 'local de execução', 'local de execucao'],
    guidance: 'Avalie logística, prazo, locais, instalação, equipe, frete e custos para cumprir o contrato.',
  },
  {
    id: 'judgment',
    title: 'Critério de julgamento e disputa',
    group: 'Proposta e disputa',
    priority: 'Alta',
    terms: ['critério de julgamento', 'criterio de julgamento', 'menor preço', 'menor preco', 'maior desconto', 'lance mínimo', 'lance minimo', 'modo de disputa'],
    guidance: 'Confirme o critério, o modo de disputa, a unidade de preço e as regras para lances e desempate.',
  },
  {
    id: 'proposal-validity',
    title: 'Validade e composição da proposta',
    group: 'Proposta e disputa',
    priority: 'Média',
    terms: ['validade da proposta', 'composição dos preços', 'composicao dos precos', 'planilha de custos', 'encargos sociais', 'tributos incidentes'],
    guidance: 'Confira validade mínima, modelo exigido, composição de custos, tributos e despesas indiretas.',
  },
  {
    id: 'penalties',
    title: 'Sanções, multas e rescisão',
    group: 'Riscos contratuais',
    priority: 'Média',
    terms: ['sanções administrativas', 'sancoes administrativas', 'multa por atraso', 'penalidades', 'rescisão contratual', 'rescisao contratual'],
    guidance: 'Leia as hipóteses de penalidade, percentuais de multa, prazos de defesa e condições de rescisão.',
  },
  {
    id: 'me-epp',
    title: 'Tratamento para ME/EPP',
    group: 'Condições comerciais',
    priority: 'Média',
    terms: ['microempresa', 'empresa de pequeno porte', 'me/epp', 'tratamento favorecido', 'cota reservada', 'empate ficto'],
    guidance: 'Confira se há tratamento favorecido, cota reservada, exclusividade ou regras de regularização fiscal.',
  },
  {
    id: 'appeals',
    title: 'Intenção de recurso e prazos recursais',
    group: 'Prazos',
    priority: 'Média',
    terms: ['intenção de recurso', 'intencao de recurso', 'razões do recurso', 'razoes do recurso', 'contrarrazões', 'contrarrazoes'],
    guidance: 'Anote quando manifestar intenção de recorrer e os prazos para razões e contrarrazões.',
  },
];

const BASE_CHECKS = [
  {
    id: 'read-annexes',
    title: 'Conferir o edital completo, todos os anexos e eventuais retificações',
    group: 'Conferência geral',
    priority: 'Alta',
    guidance: 'A análise automática pode não identificar obrigações localizadas em anexos ou tabelas.',
    snippet: '',
  },
  {
    id: 'eligibility',
    title: 'Confirmar se a empresa atende ao objeto e a todos os requisitos de participação',
    group: 'Conferência geral',
    priority: 'Alta',
    guidance: 'Compare o objeto, as atividades da empresa e cada condição de participação com o edital.',
    snippet: '',
  },
  {
    id: 'costs',
    title: 'Calcular o custo total e validar a margem antes de ofertar lances',
    group: 'Conferência geral',
    priority: 'Alta',
    guidance: 'Inclua tributos, logística, equipe, garantia, instalação, manutenção e demais custos aplicáveis.',
    snippet: '',
  },
];

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function excerptAround(text, index, length = 260) {
  if (index < 0) return '';
  const start = Math.max(0, index - 100);
  const end = Math.min(text.length, index + length);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

function makeFindings(text) {
  const normalized = normalizeText(text);
  const findings = RULES.flatMap((rule) => {
    let matchIndex = -1;
    let matchedTerm = '';

    for (const term of rule.terms) {
      const index = normalized.indexOf(normalizeText(term));
      if (index >= 0 && (matchIndex < 0 || index < matchIndex)) {
        matchIndex = index;
        matchedTerm = term;
      }
    }

    if (matchIndex < 0) return [];

    return [{
      ...rule,
      key: rule.id,
      matchedTerm,
      snippet: excerptAround(text, matchIndex),
      guidance: rule.guidance,
    }];
  });

  return [...BASE_CHECKS, ...findings];
}

function findDateCandidates(text) {
  const candidates = [];
  const seen = new Set();
  const pattern = /(data|sess[aã]o|abertura|recebimento|propostas?|impugna[cç][aã]o|esclarecimentos?|entrega|recurso|assinatura|vig[eê]ncia)[^\n.]{0,180}?\b(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})(?:\s*(?:às?|as)?\s*(\d{1,2}:\d{2}))?/gi;
  let match;
  let keyIndex = 0;

  while ((match = pattern.exec(text)) !== null && candidates.length < 30) {
    const label = match[1].replace(/\s+/g, ' ').trim();
    const date = match[2];
    const time = match[3] || '';
    const key = `${normalizeText(label)}|${date}|${time}`;

    if (!seen.has(key)) {
      seen.add(key);
      candidates.push({ id: `date-${keyIndex++}`, label, date, time, context: excerptAround(text, match.index, 190) });
    }
  }

  return candidates;
}

async function extractPdfText(file, onProgress) {
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const totalPages = pdf.numPages;
  const pagesToRead = Math.min(totalPages, MAX_PAGES);
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines = [];
      let currentLine = '';
      let previousY = null;

      for (const item of content.items) {
        if (!('str' in item) || !item.str) continue;
        const y = Array.isArray(item.transform) ? item.transform[5] : null;
        if (previousY !== null && y !== null && Math.abs(y - previousY) > 2.5) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = '';
        }
        currentLine += `${item.str} `;
        if (y !== null) previousY = y;
      }
      if (currentLine.trim()) lines.push(currentLine.trim());
      pages.push(`\n\n[Página ${pageNumber}]\n${lines.join('\n')}`);
      page.cleanup();
      onProgress?.(pageNumber, pagesToRead);
    }
  } finally {
    // O destroy() pertence ao PDFDocumentLoadingTask, não ao documento PDF.
    await loadingTask.destroy();
  }

  return {
    text: pages.join('\n').slice(0, MAX_TEXT_LENGTH).trim(),
    totalPages,
    pagesRead: pagesToRead,
  };
}

export default function EdictAnalyzerPage({ data, onCreateTask, onCreateTasks }) {
  const inputRef = React.useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [text, setText] = useState('');
  const [findings, setFindings] = useState([]);
  const [dates, setDates] = useState([]);
  const [selectedOpportunityId, setSelectedOpportunityId] = useState('');
  const [taskDate, setTaskDate] = useState('');
  const [createdTaskIds, setCreatedTaskIds] = useState(() => new Set());
  const [showExtractedText, setShowExtractedText] = useState(false);

  const opportunities = Array.isArray(data?.opportunities) ? data.opportunities : [];
  const activeFindings = findings.filter((item) => !createdTaskIds.has(item.key));
  const relatedOpportunity = opportunities.find((item) => item.id === selectedOpportunityId);

  const summary = useMemo(() => ({
    high: findings.filter((item) => item.priority === 'Alta').length,
    deadlines: dates.length,
    found: findings.length,
  }), [findings, dates]);

  async function handleFileChange(event) {
    const selectedFile = event.target.files?.[0];
    event.target.value = '';
    if (!selectedFile) return;

    setError('');
    setNotice('');
    setText('');
    setFindings([]);
    setDates([]);
    setCreatedTaskIds(new Set());

    const isPdf = selectedFile.type === 'application/pdf' || selectedFile.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setFile(null);
      setError('Selecione um arquivo PDF.');
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null);
      setError('O arquivo excede 25 MB. Reduza o tamanho do PDF e tente novamente.');
      return;
    }

    setFile(selectedFile);
    setBusy(true);
    setProgress({ current: 0, total: 0 });

    try {
      const result = await extractPdfText(selectedFile, (current, total) => setProgress({ current, total }));
      if (!result.text || result.text.replace(/\[P[aá]gina \d+\]/g, '').trim().length < 80) {
        setText('');
        setError('Não foi encontrado texto suficiente no PDF. Ele pode ser digitalizado como imagem; esta versão não inclui OCR. Tente um PDF com texto selecionável.');
        return;
      }

      setText(result.text);
      setFindings(makeFindings(result.text));
      setDates(findDateCandidates(result.text));
      setNotice(
        result.totalPages > result.pagesRead
          ? `Leitura concluída nas primeiras ${result.pagesRead} de ${result.totalPages} páginas. Confira as páginas restantes manualmente.`
          : `Texto extraído de ${result.pagesRead} página(s). A conferência automática é preliminar.`
      );
    } catch (readError) {
      console.error('Falha ao ler edital em PDF:', readError);
      setError('Não foi possível ler esse PDF. Confira se o arquivo não está protegido por senha ou corrompido e tente novamente.');
    } finally {
      setBusy(false);
      setProgress({ current: 0, total: 0 });
    }
  }

  function createOneTask(item) {
    if (!onCreateTask || createdTaskIds.has(item.key)) return;
    onCreateTask({
      title: `Edital: ${item.title}`,
      date: taskDate,
      priority: item.priority || 'Média',
      linked: selectedOpportunityId || '',
    });
    setCreatedTaskIds((current) => new Set([...current, item.key]));
  }

  function createAllTasks() {
    const pending = findings.filter((item) => !createdTaskIds.has(item.key));
    if (!pending.length) return;

    const tasks = pending.map((item) => ({
      title: `Edital: ${item.title}`,
      date: taskDate,
      priority: item.priority || 'Média',
      linked: selectedOpportunityId || '',
    }));

    if (onCreateTasks) {
      onCreateTasks(tasks);
      setCreatedTaskIds(new Set(findings.map((item) => item.key)));
      return;
    }

    if (onCreateTask && tasks.length === 1) {
      onCreateTask(tasks[0]);
      setCreatedTaskIds(new Set(findings.map((item) => item.key)));
      return;
    }

    setError('A criação em lote ainda não está conectada ao painel. Crie as tarefas individualmente ou aplique a integração descrita no arquivo INTEGRAR_ANALISE_EDITAIS.md.');
  }

  return (
    <div className="edict-page">
      <header className="edict-header">
        <div>
          <div className="edict-eyebrow"><FileSearch size={15} /> LEITURA DE DOCUMENTOS</div>
          <h1>Análise de editais</h1>
          <p>Extraia texto de um edital PDF, localize referências importantes e transforme verificações em tarefas.</p>
        </div>
        <div className="edict-private-note"><ShieldAlert size={17} /> O arquivo é processado no navegador e não é enviado ao Licita360.</div>
      </header>

      <div className="edict-disclaimer" role="note">
        <Info size={18} />
        <div><strong>Análise preliminar, não parecer jurídico.</strong><span>As regras procuram palavras e trechos do PDF. Datas e requisitos podem aparecer em anexos, tabelas ou retificações que não sejam reconhecidos automaticamente. Confira sempre o edital oficial completo.</span></div>
      </div>

      <section className="edict-upload-card">
        <div className="edict-upload-icon"><Upload size={23} /></div>
        <div className="edict-upload-copy">
          <h2>Importe o edital em PDF</h2>
          <p>Até 25 MB e 150 páginas nesta versão. O PDF precisa conter texto selecionável; arquivos digitalizados como imagens exigem OCR, ainda não incluído.</p>
          {file && <div className="edict-file-name"><FileText size={16} /><span>{file.name}</span><small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small></div>}
        </div>
        <button className="edict-button edict-button-primary" type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <><LoaderCircle size={17} className="edict-spin" /> Lendo PDF...</> : <><Upload size={17} /> Selecionar PDF</>}
        </button>
        <input ref={inputRef} className="edict-file-input" type="file" accept="application/pdf,.pdf" onChange={handleFileChange} />
        {busy && <div className="edict-progress"><span style={{ width: progress.total ? `${(progress.current / progress.total) * 100}%` : '8%' }} /></div>}
      </section>

      {error && <div className="edict-message edict-message-error" role="alert"><AlertCircle size={18} /><span>{error}</span></div>}
      {notice && <div className="edict-message edict-message-success" role="status"><CheckCircle2 size={18} /><span>{notice}</span></div>}

      {text && (
        <>
          <section className="edict-stats">
            <div className="edict-stat"><span>Verificações geradas</span><strong>{summary.found}</strong></div>
            <div className="edict-stat"><span>Itens de prioridade alta</span><strong>{summary.high}</strong></div>
            <div className="edict-stat"><span>Referências de datas</span><strong>{summary.deadlines}</strong></div>
          </section>

          <section className="edict-settings-card">
            <div className="edict-section-heading"><div><ClipboardCheck size={19} /><h2>Vincular a um processo</h2></div><span>Opcional</span></div>
            <div className="edict-form-grid">
              <label className="edict-field"><span>Processo do Licita360</span>
                <select value={selectedOpportunityId} onChange={(event) => setSelectedOpportunityId(event.target.value)}>
                  <option value="">Não vincular a um processo</option>
                  {opportunities.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
                </select>
              </label>
              <label className="edict-field"><span>Data sugerida para as tarefas</span><input type="date" value={taskDate} onChange={(event) => setTaskDate(event.target.value)} /></label>
            </div>
            {relatedOpportunity && <p className="edict-linked-process">As tarefas serão vinculadas a: <strong>{relatedOpportunity.title}</strong></p>}
          </section>

          {dates.length > 0 && (
            <section className="edict-results-section">
              <div className="edict-section-heading"><div><CalendarClock size={19} /><h2>Referências a datas encontradas</h2></div><span>{dates.length} item(ns)</span></div>
              <p className="edict-section-help">São trechos candidatos, não prazos confirmados. Confira o contexto e o ano no documento original.</p>
              <div className="edict-date-list">
                {dates.map((item) => <article className="edict-date-card" key={item.id}><div className="edict-date-value"><strong>{item.date}</strong>{item.time && <small>{item.time}</small>}</div><div className="edict-date-copy"><strong>{item.label}</strong><p>{item.context}</p></div></article>)}
              </div>
            </section>
          )}

          <section className="edict-results-section">
            <div className="edict-section-heading"><div><ClipboardCheck size={19} /><h2>Checklist preliminar de conferência</h2></div><span>{findings.length - createdTaskIds.size} pendente(s)</span></div>
            <p className="edict-section-help">Os itens identificados incluem uma amostra do trecho em que a regra encontrou uma palavra-chave. Os itens gerais devem ser conferidos mesmo quando não aparecem no texto extraído.</p>
            <div className="edict-finding-list">
              {findings.map((item) => {
                const created = createdTaskIds.has(item.key);
                return <article className={`edict-finding-card ${created ? 'is-created' : ''}`} key={item.key}>
                  <div className="edict-finding-top"><div className="edict-finding-heading"><span className="edict-finding-icon">{created ? <CheckCircle2 size={18} /> : <ClipboardCheck size={18} />}</span><div><div className="edict-finding-meta"><span>{item.group}</span><span className={`edict-priority priority-${(item.priority || 'Média').toLowerCase().replace('é', 'e').replace('í', 'i')}`}>{item.priority || 'Média'}</span></div><h3>{item.title}</h3></div></div>
                    <button className="edict-button edict-button-outline" type="button" disabled={created || !onCreateTask} onClick={() => createOneTask(item)}>{created ? <><CheckCircle2 size={15} /> Tarefa criada</> : <><Plus size={15} /> Criar tarefa</>}</button>
                  </div>
                  <p className="edict-guidance">{item.guidance}</p>
                  {item.snippet && <blockquote className="edict-snippet">“{item.snippet}”</blockquote>}
                </article>;
              })}
            </div>
            <div className="edict-bulk-actions"><span>{createdTaskIds.size} de {findings.length} tarefas criadas nesta análise.</span><button className="edict-button edict-button-primary" type="button" disabled={!activeFindings.length || (!onCreateTasks && activeFindings.length > 1)} onClick={createAllTasks}><Plus size={17} /> Criar tarefas pendentes ({activeFindings.length})</button></div>
          </section>

          <section className="edict-text-panel">
            <button type="button" className="edict-text-toggle" onClick={() => setShowExtractedText((value) => !value)}><FileText size={18} /> {showExtractedText ? 'Ocultar texto extraído' : 'Ver texto extraído'} <span>{showExtractedText ? '−' : '+'}</span></button>
            {showExtractedText && <pre>{text}</pre>}
          </section>
          {file && <p className="edict-local-file-note"><Info size={15} /> O nome do arquivo e o texto extraído não são salvos no banco. Ao sair ou atualizar a página, será necessário selecionar o PDF novamente.</p>}
        </>
      )}

      {!text && !busy && !error && (
        <section className="edict-empty-state"><div><FileSearch size={27} /></div><h2>Pronto para analisar um edital</h2><p>Selecione um PDF para extrair referências a prazos, habilitação, critérios de julgamento, garantias, entrega, multas e outros requisitos.</p></section>
      )}
    </div>
  );
}
