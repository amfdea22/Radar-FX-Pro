#!/usr/bin/env python3
"""Financial Modeling Prep MCP Client — agente financeiro via FastMCP"""

import asyncio
import json
import os
import sys
from fastmcp import Client

FMP_API_KEY = os.environ.get("FMP_API_KEY", "38H3sDW3t09VitCF3QJe3f0X2g8ZlQJc")
FMP_MCP_URL = f"https://financialmodelingprep.com/mcp?apikey={FMP_API_KEY}"


async def list_tools():
    async with Client(FMP_MCP_URL) as client:
        tools = await client.list_tools()
        print("=== Ferramentas disponíveis ===")
        for t in tools:
            print(f"  {t.name}: {t.description or 'sem descrição'}")
        return tools


async def call_tool(name: str, args: dict):
    async with Client(FMP_MCP_URL) as client:
        result = await client.call_tool(name, args)
        return result


async def main():
    if len(sys.argv) < 2:
        print("Uso: fmp_agent.py <tool> [json_args]")
        print("   ou: fmp_agent.py --list-tools")
        print()
        print("Exemplos:")
        print('  fmp_agent.py quote {"symbol": "AAPL"}')
        print('  fmp_agent.py --list-tools')
        return

    if sys.argv[1] == "--list-tools":
        await list_tools()
        return

    tool_name = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else {}

    result = await call_tool(tool_name, args)
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
