# Fuply

CRM para pequenos negócios organizarem leads, follow-ups, equipe e conversas comerciais do WhatsApp.

## Desenvolvimento

Requer Node.js 22.12 ou superior.

```bash
npm install
npm run dev
```

Validação completa:

```bash
npm run check
```

## Backend

O frontend usa Supabase Auth, Postgres, RLS e Realtime. O schema versionado está em `supabase/migrations`. Leads e atividades são isolados por workspace; `user_id` registra o criador e `assigned_to` registra o responsável atual.

## Demonstrações protegidas

As rotas `?demo=jacob`, `?demo=able` e `?demo=innova` exigem token temporário validado por `api/demo-access.js`. Os hashes e as datas de expiração são variáveis server-only da Vercel, listadas em `.env.example`; não coloque tokens ou hashes diretamente no código.

Para gerar um hash SHA-256 sem salvar o token no repositório:

```bash
node -e "const c=require('node:crypto'); process.stdout.write(c.createHash('sha256').update(process.argv[1]).digest('hex'))" "TOKEN_TEMPORARIO"
```

Configure cada hash e expiração nos ambientes necessários da Vercel. Sem configuração válida, a demonstração é negada por padrão.

## Fluxo de publicação

O repositório `felipetdreux-eng/WhatsCRM` publica no Vercel. Antes de integrar mudanças ao `main`, execute os testes, o build e confirme que as migrations do Git correspondem ao histórico do Supabase.
