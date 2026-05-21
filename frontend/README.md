# Tutorial Generator - Frontend

Interface web moderna para capturar ações do usuário e gerar tutoriais passo-a-passo.

## 🎯 Características

- **Captura em Tempo Real** - Monitora clicks, digitação, navegação e scroll
- **Screenshots Automáticas** - Captura a tela após cada ação para referência visual
- **Interface Intuitiva** - Design responsivo e fácil de usar
- **Visualização de Eventos** - Veja cada ação capturada em detalhes com preview da tela
- **Geração de Tutoriais** - Converta eventos em tutoriais estruturados com screenshots
- **Modo IA** - Use GPT-4o para gerar instruções em português natural
- **Modo Offline** - Funciona sem API key com modo heurístico
- **Exportação** - Baixe eventos como JSON para análise

## 📁 Estrutura

```
frontend/
├── index.html          # Interface principal
├── styles.css          # Estilos CSS (responsivo)
├── app.js             # Aplicação principal (JavaScript compiled)
├── recorder.ts        # Capturador de eventos (TypeScript)
├── uploader.ts        # Comunicação com backend (TypeScript)
├── app.ts             # Orquestrador (TypeScript)
├── tsconfig.json      # Configuração TypeScript
└── package.json       # Dependências npm
```

## 🚀 Como Usar

### Opção 1: Usar com o Servidor Flask (Recomendado)

```bash
# 1. Instale as dependências
cd ..
pip install -r requirements.txt

# 2. Inicie o servidor
python server.py

# 3. Abra no navegador
# http://localhost:5000
```

### Opção 2: Servir localmente com Python

```bash
cd frontend
python -m http.server 8000

# Abra no navegador
# http://localhost:8000
```

### Opção 3: Usar com Node.js (se tiver instalado)

```bash
cd frontend
npx http-server
```

## 🛠️ Desenvolvendo

Se quiser modificar o TypeScript e recompilar:

```bash
# Instale dependências dev
npm install

# Compile TypeScript para JavaScript
npm run build

# ou em modo watch
npm run watch
```

## 🔌 API Endpoints

### `POST /api/generate-tutorial`

Gera um tutorial a partir dos eventos capturados.

**Request:**

```json
{
  "events": [
    {
      "type": "click",
      "timestamp": 1234,
      "details": {
        "x": 100,
        "y": 200,
        "button": "left",
        "target": "#button-id"
      }
    }
  ],
  "use_ai": true,
  "analyze_screenshots": false,
  "model": "gpt-4o"
}
```

**Response:**

```json
{
  "title": "Como fazer...",
  "summary": "Resumo do tutorial",
  "steps": [
    {
      "action_type": "click",
      "instruction": "Clique no botão...",
      "details": {}
    }
  ]
}
```

### `GET /health`

Verifica se o servidor está online.

**Response:**

```json
{
  "status": "healthy",
  "service": "tutorial-generator"
}
```

### `GET /api/info`

Obtém informações sobre o servidor.

**Response:**

```json
{
    "name": "Tutorial Generator API",
    "version": "1.0.0",
    "description": "...",
    "features": [...]
}
```

## ⚙️ Configurações

Acesse a aba "Configurações" para:

- **URL do Backend** - Altere para conectar a um servidor diferente
- **Usar IA** - Ative/desative geração com OpenAI
- **Capturar Screenshots** - Ativa captura automática da tela a cada ação (pode deixar mais lento)
- **Analisar Screenshots** - Use IA para descrever os elementos visuais capturados

As configurações são salvas localmente no navegador (localStorage).

## 📸 Sobre as Screenshots

- **Ativação**: Marque "Capturar Screenshots" nas configurações
- **Performance**: Capturar screenshots pode deixar a gravação mais lenta
- **Visualização**: As screenshots aparecem nos eventos e nos tutoriais gerados
- **Tamanho**: As imagens são comprimidas para não usar muita memória
- **Privacidade**: As screenshots são processadas localmente e opcionalmente no backend

## 📊 Eventos com Screenshots

Cada evento capturado pode incluir uma screenshot:

```javascript
{
    type: "click",
    timestamp: 1234,
    details: { x: 100, y: 200, button: "left", target: "#button" },
    screenshot: "data:image/jpeg;base64,..." // Screenshot JPEG em base64
}
```

## 📱 Responsividade

A interface funciona perfeitamente em:

- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🎨 Temas

O design segue a paleta de cores:

- **Primário:** Azul (#3b82f6)
- **Perigo:** Vermelho (#ef4444)
- **Sucesso:** Verde (#10b981)
- **Aviso:** Âmbar (#f59e0b)

## 🐛 Troubleshooting

## 🔌 Empacotar como Extensão (Chrome / Edge / Firefox)

1. Abra o Chrome, Edge ou Firefox e carregue a pasta `frontend/` como extensão sem compactação.
2. No Firefox, use a tela de extensões do navegador e carregue a mesma pasta `frontend/` como extensão temporária.
3. Clique no ícone da extensão para abrir o popup ou abra a página `index.html` da extensão em uma nova aba.
4. Clique em "Começar Gravação" — o navegador pedirá permissão para compartilhar a tela/janela real. Selecione a janela que deseja capturar.

Observações:

- A captura da janela real é feita com `navigator.mediaDevices.getDisplayMedia`, compatível com Chrome, Edge e Firefox modernos.
- O popup usa um script local externo, porque extensões MV3 bloqueiam script inline.
- A captura de screenshots do DOM depende de empacotar `html2canvas` localmente; a extensão funciona sem CDN.
- Se o usuário negar a permissão, a gravação continuará sem screenshots.

### "Falha ao conectar ao backend"

- Verifique se o servidor Flask está rodando
- Confira a URL do backend nas configurações
- Certifique-se que CORS está habilitado

### "Nenhum evento foi capturado"

- Verifique se você clicou em "Começar Gravação"
- Realize ações no navegador (clicks, digitação, etc)
- O console do navegador mostrará erros se houver

### "Erro ao gerar tutorial"

- Verifique se tem eventos capturados
- Se usar IA, confirme que OPENAI_API_KEY está configurada
- Tente o modo "Sem IA" para debugging

## 📚 Exemplos de Eventos

A aplicação captura automaticamente:

```javascript
// Click
{ type: "click", details: { x: 100, y: 200, button: "left" } }

// Digitação
{ type: "type", details: { text: "olá mundo" } }

// Tecla especial
{ type: "special_key", details: { key: "enter" } }

// Scroll
{ type: "scroll", details: { scrollX: 0, scrollY: 500 } }

// Drag
{ type: "drag", details: { x: 100, y: 200 } }
```

## 🔐 Segurança

- Os eventos são processados no backend (servidor seguro)
- Configurações sensíveis não são salvas no localStorage
- API key do OpenAI fica no servidor, nunca no frontend
- CORS está configurado para aceitar requisições

## 📝 Licença

MIT

## 🤝 Contribuições

Contribuições são bem-vindas! Faça um fork, crie uma branch e envie um pull request.

## 📧 Suporte

Para dúvidas ou problemas, abra uma issue no repositório.
