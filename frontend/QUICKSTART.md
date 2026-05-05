# 🚀 Guia de Uso Rápido - Frontend Screenshot

## Início Rápido

```bash
# 1. Instale as dependências
cd /workspaces/homolog2
pip install -r requirements.txt

# 2. Inicie o servidor
python server.py

# 3. Abra no navegador
# http://localhost:5000
```

## 📸 Capturando com Screenshots

### Ativando Screenshots

1. Abra as **Configurações** (aba ⚙️)
2. Marque a opção **"Capturar Screenshots"**
3. Clique em **"Salvar Configurações"**

### Gravando Eventos

1. Na aba **"Eventos"**, clique em **"▶ Começar Gravação"**
2. Realize as ações que deseja documentar:
   - Clique em elementos
   - Digite texto
   - Pressione teclas especiais
   - Role a página
3. Clique em **"⏹ Parar Gravação"**

### Visualizando Eventos

- Cada evento mostrará uma **miniatura da screenshot** capturada
- Passe o mouse sobre a imagem para uma pré-visualização
- As screenshots ajudam a verificar a precisão da captura

## 🤖 Gerando Tutoriais

### Modo IA (Recomendado)

1. Certifique-se que `OPENAI_API_KEY` está configurada no servidor
2. Na aba **"Tutorial"**, clique em **"✨ Gerar Tutorial com IA"**
3. O tutorial será gerado com:
   - Título automático
   - Instruções em português natural
   - Screenshots para cada passo

### Modo Offline (Sem IA)

1. Na aba **"Tutorial"**, clique em **"🔧 Gerar (Sem IA)"**
2. Funciona sem API key
3. Gera instruções baseadas em heurísticas

## 💾 Exportando Dados

- Clique em **"💾 Exportar JSON"** para baixar os eventos capturados
- Formato: Array de eventos com screenshots em base64

## ⚙️ Configurações Disponíveis

```
URL do Backend: http://localhost:5000
Usar IA: ☑ (marcar para GPT-4o)
Capturar Screenshots: ☑ (marcar para screenshots automáticas)
Analisar Screenshots: ☐ (marcar para análise visual com IA)
```

## 🎨 Interface

- **Aba Eventos**: Veja cada ação capturada com previews
- **Aba Tutorial**: Tutorial final com instruções e screenshots
- **Aba Configurações**: Ajuste comportamento da aplicação

## 🐛 Troubleshooting

### Screenshots não aparecem

- Verifique se "Capturar Screenshots" está marcado ✓
- Recarregue a página
- Verifique o console (F12) para erros

### Servidor não responde

- Confirme que está rodando: `python server.py`
- Verifique a porta: `http://localhost:5000`
- Confira o firewall/proxy

### Lento ao capturar

- Screenshots podem deixar a gravação mais lenta
- Desmarque "Capturar Screenshots" se não precisar
- Use em um navegador mais rápido

## 📝 Exemplo de Eventos

```json
[
  {
    "type": "click",
    "timestamp": 1234,
    "details": {
      "x": 100,
      "y": 200,
      "button": "left",
      "target": "#submit-btn"
    },
    "screenshot": "data:image/jpeg;base64,..."
  },
  {
    "type": "type",
    "timestamp": 5678,
    "details": {
      "text": "João Silva"
    },
    "screenshot": "data:image/jpeg;base64,..."
  }
]
```

## 📚 Documentação Completa

Veja [README.md](./README.md) para documentação completa e detalhes técnicos.

## 🎯 Dicas

- Use screenshots para tutoriais mais claros
- Screenshots ocupam mais espaço (podem aumentar JSON)
- Ative análise de screenshots para descrições mais precisas
- Exporte logs para troubleshooting
- Use modo offline para testes rápidos

Aproveite! 🎉
