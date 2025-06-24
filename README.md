# Chatbot UI

A lightweight and modern chat interface for LLM interactions with Markdown support!

👉 Looking for a version with web search integration?   
Check out the [`websearch_template`](https://github.com/ChristophHandschuh/chatbot-ui/tree/websearch_template) branch, which includes contributions from [CameliaK](https://github.com/CameliaK)

## Overview

A minimalist chat interface built with React and TypeScript, designed to be easily integrated with any LLM backend. Features a clean and modern design.

![Demo](demo/image.png)

## Getting Started

1. Clone the repository
```bash
git clone https://github.com/ChristophHandschuh/chatbot-ui.git
cd chatbot-ui
```

2. Install dependencies
```bash
npm i
```

3. Start the development server
```bash
npm run dev
```

### Configuring the Agent API Endpoint

The `sessionManager.ts` uses an API endpoint to create and manage user sessions on the backend. By default, this is set to `http://localhost:8000`.
To configure the frontend to use a different backend API endpoint for session management, you can set the `VITE_AGENT_API_BASE_URL` environment variable before building or running the development server.

For example, you can create a `.env` file in the project root directory with the following content:

```
VITE_AGENT_API_BASE_URL=http://your-actual-backend.com
```

This would make the session manager connect to `http://your-actual-backend.com/apps/...` for session operations.

Alternatively, you can set the variable directly when running the development server:

```bash
VITE_AGENT_API_BASE_URL=http://your-actual-backend.com npm run dev
```

If `VITE_AGENT_API_BASE_URL` is set, it will be used as the base URL for session management API calls. Otherwise, it defaults to `http://localhost:8000`.

## Test Mode

The project includes a test backend for development and testing purposes. To use the test mode:

1. Navigate to the testbackend directory
2. Create a Python virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate
```
3. Install the required package:
```bash
pip install websockets
```
4. Run the test backend:
```bash
python test.py
```

## Credits

This project was built by:
- [Leon Binder](https://github.com/LeonBinder)
- [Christoph Handschuh](https://github.com/ChristophHandschuh)

Additional contribution by:
- [CameliaK](https://github.com/CameliaK) – Implemented web search and integrated it into the LLM prompt

Some code components were inspired by and adapted from [Vercel's AI Chatbot](https://github.com/vercel/ai-chatbot).

## License

This project is licensed under the Apache License 2.0. Please note that some components were adapted from Vercel's open source AI Chatbot project.
