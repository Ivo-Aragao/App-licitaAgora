# Licita360 — integrar Análise de Editais

Este módulo extrai texto de PDFs no navegador com PDF.js e executa uma busca preliminar por palavras-chave. O arquivo e o texto extraído não são enviados ao backend nem persistidos no banco.

## 1. Instale a dependência

Na raiz do projeto:

```powershell
npm install pdfjs-dist
```

O módulo usa o worker fornecido pelo pacote instalado via importação `?url`, mantendo a versão do worker alinhada à biblioteca e evitando depender de um CDN externo. A versão atual do PDF.js pode exigir um Node recente no ambiente de desenvolvimento; consulte os requisitos publicados pelo pacote se o `npm install` alertar sobre a versão do Node.

## 2. Copie os arquivos

Copie para o projeto:

```text
components/dashboard/EdictAnalyzerPage.jsx
components/dashboard/EdictAnalyzerPage.css
```

## 3. Adicione o ícone e a opção no menu

Em `utils/licita360.js`, adicione `FileSearch` à importação de `lucide-react`:

```js
import {
  LayoutDashboard,
  Radar,
  BriefcaseBusiness,
  ListTodo,
  FolderOpen,
  Wallet,
  Users,
  BellRing,
  Sparkles,
  FileSearch,
} from 'lucide-react';
```

Dentro de `export const nav = [...]`, adicione um item — por exemplo logo depois do Assistente de decisão:

```js
{
  id: 'edict-analysis',
  label: 'Análise de editais',
  icon: FileSearch,
  group: 'WORKSPACE',
},
```

Preserve os outros itens existentes, incluindo o item `assistant` já adicionado.

## 4. Importe a página no DashboardApp

Em `features/dashboard/DashboardApp.jsx`, adicione junto às importações dos componentes de dashboard:

```jsx
import EdictAnalyzerPage from '../../components/dashboard/EdictAnalyzerPage.jsx';
```

Adicione esta função ao corpo de `DashboardApp`, perto da função `addTask` existente. Esta versão evita sobrescrever tarefas quando várias são criadas em sequência:

```jsx
function addTasks(tasksToAdd) {
  const newTasks = tasksToAdd.map((task) => ({
    ...task,
    id: uid(),
    done: false,
  }));

  setData((current) => ({
    ...current,
    tasks: [...newTasks, ...current.tasks],
  }));

  setToast(`${newTasks.length} tarefa(s) criada(s) a partir do edital.`);
}
```

Dentro de `<div className="page-content">`, acrescente este bloco antes da condição `page === 'processes'`:

```jsx
{page === 'edict-analysis' && (
  <EdictAnalyzerPage
    data={data}
    onCreateTask={addTask}
    onCreateTasks={addTasks}
  />
)}
```

## 5. Compile e teste

```powershell
npm run build
```

Depois abra o item **Análise de editais** no menu, selecione um edital em PDF com texto selecionável e confira:

- extração do texto e página atual da leitura;
- candidatos a datas e horários;
- checklist preliminar com trechos correspondentes;
- criação individual ou em lote de tarefas;
- vínculo opcional das tarefas com um processo existente.

## Limitações conhecidas

- Não faz OCR em PDFs que sejam apenas imagens.
- A detecção é por palavras-chave e não é um modelo de IA; pode deixar de localizar itens ou associar um trecho ao contexto errado.
- Datas extraídas são candidatas e precisam de confirmação manual no documento oficial.
- A extração fica apenas na memória do navegador; atualizar a página descarta o texto extraído.
- O arquivo não é enviado ao servidor. Isso reduz a exposição, mas não substitui o cuidado do usuário ao abrir PDFs desconhecidos.
