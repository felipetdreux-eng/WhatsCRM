# Relatório da noite: 24/11/2026

Branch: `noite/2026-11-24-testes-auditoria` (criada a partir de `main`). Nada de merge, PR, deploy ou chamada ao Supabase real.

## Resumo em 5 linhas

1. A suíte foi de **26 testes em 6 arquivos (~320 linhas)** para **157 testes em 18 arquivos (~1.960 linhas)**: 151 passam e 6 ficaram como `todo` (possíveis bugs que deixei sem corrigir).
2. **4 bugs corrigidos**, todos na importação de planilha. O pior: um valor em texto ("a combinar") virava R$ 0 e **apagava o valor do lead existente**.
3. O achado mais grave da auditoria: **o repositório não tem as migrações de `workspaces`, `workspace_members`, `leads.workspace_id` nem das funções `private.*`**. As RLS que isolam uma equipe da outra existem só no banco de produção, e não consigo verificá-las pelo código.
4. Segundo mais grave: `submit_site_lead` pode ser chamada por qualquer pessoa na internet (`anon`) e **sobrescreve nome, empresa, origem e as observações inteiras** de um lead já existente com o mesmo telefone.
5. `npm run check` passa.

## O que foi feito

Todos os módulos da lista têm testes agora:

| Módulo | Arquivo de teste |
|---|---|
| src/domain.js | domain.test.js (já existia), **domain-phone.test.js** |
| src/importUtils.js | import.test.js (já existia), **import-edge.test.js**, **import-bugs.test.js** |
| src/duplicateLeads.js | **duplicate-leads.test.js** |
| src/leadIntelligence.js | **lead-intelligence.test.js** |
| src/leadTemperature.js, src/autopilotEngine.js | temperature/autopilot (já existiam), **temperature-autopilot-edge.test.js**, **timezone.test.js** |
| src/accountStorage.js | **account-storage.test.js** |
| src/pendingLeadWrites.js | pending-lead-writes.test.js (ampliado) |
| src/automationBackend.js | automation-backend.test.js (já existia), **automation-backend-supabase.test.js** |
| src/backendBridge.js | **backend-bridge.test.js** |
| src/whatsappInboxBackend.js | **whatsapp-inbox-backend.test.js** |
| api/demo-access.js, api/waha-webhook.js | **api.test.js** |

O que os testes cobrem: telefone com e sem +55, DDD inválido, DDD 55 (RS) sem DDI, nono dígito, celular antigo de 8 dígitos, espaços, pontos e traços; CSV com `;`, `,` e tab, BOM do Excel, aspas escapadas, quebra de linha dentro de aspas e linhas vazias; nomes com acento; datas BR, ISO, serial do Excel e datas impossíveis; dinheiro em formato BR; duplicatas; fuso America/Sao_Paulo (23h30 local, que já é o dia seguinte em UTC).

Mocks: `tests/helpers/fakes.js` tem um `localStorage` em memória e um Supabase falso (query builder encadeável que registra as chamadas). O `api.test.js` troca o `fetch` global por um que **falha se algo tentar sair para a rede**. Nenhuma dependência nova.

Módulos sem teste, de propósito: `pipelineDragScroll.js`, `bootstrap.js` e os `*DemoData.js`. Os dois primeiros são DOM/UI, os outros são só dados.

## Bugs corrigidos

Cada correção está num commit próprio, junto com o teste que prova o bug (`tests/import-bugs.test.js`).

- `eb15f39`: valor sem número ("a combinar") virava R$ 0. Numa atualização isso apagava o valor do lead existente, e o aviso "valor não reconhecido" nunca aparecia.
- `1d71345`: "R$ 1.250" era lido como 1,25 e "1.500.000" era descartado. O ponto agora vale como milhar só quando os grupos têm exatamente 3 dígitos; "99.90" continua sendo decimal.
- `2a2f821`: datas impossíveis ("31/02/2026", mês 13) passavam como `2026-02-31`. A coluna `next_contact` é DATE, então o upsert do lote inteiro falharia. Agora a data vira vazio e gera um aviso.
- `e176b08`: uma coluna com cabeçalho vazio (comum como coluna de índice em exportações) era mapeada como "Nome", porque `''` casava com qualquer alias.

Também há um commit de apoio, `fd2ea71`: três imports sem extensão (`'./supabaseClient'`, `'./leadTemperature'`, `'./pendingLeadWrites'`) ganharam `.js`. Sem isso o Node não importa esses módulos nos testes. O Vite continua resolvendo igual e o build passou.

## Possíveis bugs NÃO corrigidos (preciso da sua decisão)

Os marcados com `todo` estão como `test.todo` nos testes.

1. **WhatsApp sem o nono dígito não casa com o lead** (`supabase/migrations/20260917183000_waha_readonly_inbox.sql:262-274`). Muitos JIDs brasileiros chegam como `55 + DDD + 8 dígitos`, enquanto o lead está salvo com 11 dígitos. A mensagem entra na caixa de entrada sem `lead_id` e a automação não pausa quando o lead responde. Pelo impacto, é o mais importante desta lista. Exige migração nova, então não mexi (todo em duplicate-leads e domain-phone).
2. **Lead "Fechado" sem valor de venda some sem aviso** (`src/backendBridge.js:344`). O `syncLeads` filtra o lead fora e não avisa ninguém: o usuário acha que salvou, mas o lead nunca chega ao Supabase. Testei o comportamento atual em `backend-bridge.test.js`.
3. **Telefone com e sem 55 não é tratado como o mesmo** em `submit_site_lead`, que salva os dígitos crus (`20260913004728_fix_site_lead_workspace_conflict.sql:35`). O app salva `21999999999` e o site salva `5521999999999`, então a constraint `unique(workspace_id, phone)` não pega a duplicata.
4. `normalizeStatus("Não fechado")` vira `Fechado` (todo). Não sei qual etapa você quer para esse caso.
5. Prefixo de discagem 0 ("021 99999-9999") é recusado como inválido (todo). Ele é comum em planilhas, mas "0 + código de operadora" também aparece.
6. `parseMoney("1,250.50")` (formato americano) vira 1,2505 (todo). É raro numa base brasileira.
7. `duplicateGroupCount`: uma cadeia A~B~C conta como 2 grupos em vez de 1 (todo). Depende do que você chama de "grupo".
8. No modo demo, as configurações de automação não passam pelos mesmos limites do salvamento real (todo).
9. `currency('abc')` mostra "R$ NaN".
10. Lead com `updatedAt` corrompido é tratado como "interação muito recente" (idle = 0), quando deveria ser o contrário.
11. `installSyncBridge` (`src/backendBridge.js:437-506`) assina o realtime da equipe ativa uma vez só. Depois de `setActiveWorkspace`, o canal continua na equipe antiga até recarregar a página. Não provei com teste porque é código de navegador.

## Achados de segurança (do mais grave ao menos grave)

**CRÍTICO: as RLS de equipe não estão versionadas.** Nenhuma migração cria `public.workspaces`, `public.workspace_members`, a coluna `leads.workspace_id`, `private.user_workspace_ids()`, `private.is_workspace_member()`, `create_workspace_invite`, `join_workspace_by_code` ou `set_active_workspace`. No repositório, a única política de `leads` é por `user_id` (`20260909030000_initial_zapflow_backend.sql:77-80`), e o app filtra por `workspace_id` (`src/backendBridge.js:334`). Ou seja, o isolamento entre equipes depende de políticas que só existem em produção e que ninguém revisa. O mesmo vale para `profiles_update_own` (`:75`): ela deixa o usuário gravar qualquer `active_workspace_id`, e se isso dá acesso a outra equipe depende de código que não está aqui.
→ Correção: rodar `supabase db pull` (ou `pg_dump --schema-only`) e commitar o schema real. Depois disso, revisar as políticas de `leads`, `workspaces`, `workspace_members` e as funções de convite.

**ALTO: `submit_site_lead` sobrescreve leads existentes e qualquer pessoa pode chamá-la** (`20260913004728_fix_site_lead_workspace_conflict.sql:94-104`, grant para `anon` em `20260911213411_add_public_site_lead_capture.sql:101`). A `public_key` vai no HTML do site do cliente, então é pública. Com ela, qualquer pessoa troca `name`, `company`, `origin` e **substitui `notes` inteiro** (`notes = excluded.notes` apaga o histórico) de qualquer lead da equipe, bastando saber ou chutar o telefone. Também não há limite de requisições, então dá para encher o CRM de lixo.
→ Correção: no conflito, só acrescentar notas (como a versão anterior fazia com `concat_ws`) e não tocar em nome, empresa e origem. Adicionar rate limit por IP ou chave (Edge Function na frente da RPC, ou captcha).

**MÉDIO: `automation_outbox` aceita insert e update de qualquer membro, sem checar o lead** (`20260915233405_automation_engine_v1.sql:90-99`). A política só confere o `workspace_id`. Um membro consegue criar itens com `lead_id` de outra equipe (a FK não confere a equipe), mensagem arbitrária e `status='sent'`, e também consegue mover um item para outra equipe da qual participa.
→ Correção: no `with check`, exigir que o lead pertença ao mesmo `workspace_id`, e limitar o update às colunas `status` e `cancel_reason` (ou usar uma RPC).

**MÉDIO: `lead_activities` está presa a `user_id`** (`20260909184500_optimize_lead_activities_policies.sql:7-22`). Um membro não vê o histórico que o colega registrou e não consegue registrar atividade num lead criado por outra pessoa (o insert exige `leads.user_id = auth.uid()`). Não é vazamento, é o contrário, mas a política ficou desalinhada com o modelo de equipe. Se produção tem outra política, cai no problema do item crítico.

**MÉDIO: Edge Function `sales-copilot` sem limite de tamanho** (`supabase/functions/sales-copilot/index.ts:444-454`). O `sales-assistant` limita `conversation` a 12.000 caracteres; o copilot não limita nada. Qualquer usuário logado pode mandar textos enormes para a OpenAI por conta sua. Nenhuma das duas funções tem rate limit, e as duas usam `Access-Control-Allow-Origin: *` (`index.ts:5` nas duas).
→ Correção: copiar os limites do assistant, adicionar rate limit por usuário e restringir o CORS ao domínio do app.

**BAIXO: `sales-copilot` devolve trechos de erro da OpenAI ao cliente** (`index.ts:562`, `aiErrorSummary`).

**BAIXO: senha da demo sem salt e enviada na URL** (`api/demo-access.js:5,9`; `src/main.jsx:68`). Os hashes SHA-256 estão no repositório. Se o token for curto, dá para descobri-lo offline. Além disso, ele vai na query string e aparece em logs e no histórico do navegador. E os dados da demo estão no bundle do frontend de qualquer jeito, então o bloqueio é só cosmético. As duas demos já expiraram (setembro de 2026).

**BAIXO: realtime de DELETE sem filtro** (`src/backendBridge.js:502`). O Supabase não aplica RLS a eventos DELETE, então qualquer usuário logado recebe o id de leads apagados em outras equipes. Só vaza a chave primária, e o próprio código já documenta isso.

**BAIXO: `ingest_waha_event` sem limite de payload** (`20260917183000_waha_readonly_inbox.sql:320`). O `raw_payload` é guardado inteiro, e um `fromMe` com valor inválido derruba a RPC com 500 (`:214`).

**Sem problema:** não achei nenhuma chave secreta no frontend, no `dist` ou em `api/`. A `sb_publishable_...` em `src/supabaseClient.js:4` e `api/waha-webhook.js:4` é pública por definição. Mesmo assim, valeria tirá-la do código e passar a ler de variável de ambiente, para trocar de projeto sem precisar de commit. A `OPENAI_API_KEY` só existe nas Edge Functions. Não há `dangerouslySetInnerHTML` em `src`.

## Dívidas técnicas

- **`node_modules` (5.125 arquivos) e `dist` estão commitados, e não existe `.gitignore`.** Isso deixa o clone pesado e gera diffs gigantes. Recomendo criar o `.gitignore` e rodar `git rm -r --cached node_modules dist` (a decisão é sua; não mexi). Hoje o `dist` commitado já está desatualizado em relação ao `src`: o `npm run check` regenera e altera esses arquivos (eu revertia depois de cada build).
- **31 arquivos CSS em `src/`**, com vários "fix" empilhados (`dark.css`, `dark-integrated.css`, `dark-command-fix.css`, `daily-pages-dark.css`...). É sinal de correção por sobreposição.
- **Schema do banco fora do repositório** (ver o item crítico).
- **Lógica duplicada:** `localDateKey`, `dayDiff` e `daysWithoutInteraction` existem quase iguais em `domain.js`, `leadTemperature.js` e `autopilotEngine.js`. `normalizePhone` (`duplicateLeads.js`) copia `canonicalPhone` (`domain.js`). `readJSON` existe em `accountStorage.js` e em `backendBridge.js`. Hoje estão iguais, mas é o tipo de coisa que diverge.
- O mesmo `process_workspace_automations` foi redefinido inteiro em duas migrações seguidas, e `submit_site_lead` três vezes. Cada mudança copia mais de 100 linhas.
- `stableLeadId` (`backendBridge.js:54`) grava o mapa de ids no `localStorage` a cada lead, inclusive quando nada mudou.
- O `App.jsx` concentra muita lógica de estado, o que dificulta testar sem UI.
- Chaves de `localStorage` ainda usam o nome antigo, `zapflow-*`.

## Decisões que tomei sozinho

- Adicionei `.js` em três imports do `src` para poder testar. A mudança é mínima e reversível; se preferir, dá para usar um loader nos testes.
- "R$ 1.250" passa a valer 1.250 (milhar BR), não 1,25. Escolhi isso porque o público é brasileiro.
- Data impossível vira vazio com aviso, em vez de erro que bloqueia a linha. Foi a opção mais conservadora: o lead entra e só perde a data.
- Itens ambíguos ficaram como `test.todo` ou como teste do comportamento atual com um comentário, não como correção.
- Não toquei em migrações, UI, CSS, `dist` nem `node_modules`, e não abri PR.

## Como conferir

```bash
git fetch origin noite/2026-11-24-testes-auditoria
git checkout noite/2026-11-24-testes-auditoria
npm test                                   # 157 testes: 151 ok, 6 todo
npm run check                              # testes + build
git checkout -- dist && git clean -fd dist # desfaz o dist regenerado pelo build
git log --oneline main..HEAD               # commits da noite
git log --oneline --grep '^fix:' main..HEAD
node --test tests/import-bugs.test.js      # os 4 bugs corrigidos
git checkout main -- src/importUtils.js; node --test tests/import-bugs.test.js; git checkout HEAD -- src/importUtils.js  # prova: os 4 falham sem a correção
```

## Problemas encontrados durante o trabalho

- A sessão foi reiniciada uma vez no começo. Não perdi trabalho, porque a branch já estava criada e enviada.
- `npm run check` altera arquivos versionados em `dist/`, porque o `dist` está no git. Reverti depois de cada build para não commitar artefato.
- Não deu para validar SQL e RLS de verdade: não rodei nada contra o Supabase (era proibido) e o schema do repositório está incompleto. Os achados de SQL vêm de leitura do código.
