"""
Wolf Bot Backtest Runner
Gera relatorio completo do backtest da estrategia SMC+Wyckoff com Scale-Out
"""
import sys, os, json, traceback
from datetime import datetime
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from backtest_engine import run_backtest, STRATEGY_MAP
from data_fetcher import fetch_historical_data
from instruments import TIMEFRAME_MAP


def format_trades(trades, initial_capital):
    """Formata trades para o relatorio com win/loss, parcial etc"""
    rows = []
    balance = initial_capital
    for i, t in enumerate(trades):
        pnl = t.get('pnl', 0)
        bal = t.get('balance', balance + pnl)
        is_partial = 'PARTIAL' in t.get('comment', '')
        result = 'WIN' if pnl > 0 else 'LOSS'
        rows.append({
            '#': i + 1,
            'Ticket': t.get('ticket', ''),
            'Acao': t.get('action', ''),
            'Entrada': t.get('entry_price', 0),
            'Saida': t.get('exit_price', 0),
            'Volume': t.get('volume', 0),
            'PnL': round(pnl, 2),
            'Resultado': result,
            'Parcial': 'SIM' if is_partial else '',
            'Comment': t.get('comment', ''),
            'Bal Pos': round(bal, 2),
        })
        balance = bal
    return rows


def generate_report(result: dict, symbol: str, timeframe: str, config: dict) -> str:
    m = result['metrics']
    trades = result.get('trades', [])
    eq = result.get('equity_curve', [])

    # Agrupar trades por ticket (juntar parciais)
    main_trades = {}
    for t in trades:
        ticket = t.get('ticket', 0)
        if ticket not in main_trades:
            main_trades[ticket] = t
        else:
            main_trades[ticket]['pnl'] = main_trades[ticket].get('pnl', 0) + t.get('pnl', 0)

    main_list = sorted(main_trades.values(), key=lambda x: x.get('entry_time', ''))
    total_main = len(main_list)
    wins_main = sum(1 for t in main_list if t.get('pnl', 0) > 0)
    losses_main = sum(1 for t in main_list if t.get('pnl', 0) <= 0)

    # Estatisticas de BE+Custos
    be_trades = [t for t in trades if 'BE+CUSTOS' in t.get('comment', '') or 'BE+CUSTOS' in str(t.get('comment', ''))]
    partials = [t for t in trades if 'PARTIAL' in t.get('comment', '')]

    lines = []
    lines.append('=' * 80)
    lines.append('  WOLF BOT — RELATORIO DE BACKTEST')
    lines.append(f'  Estrategia: SMC + Wyckoff + FVG 50% + Scale-Out + BE+Custos')
    lines.append(f'  Data: {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    lines.append('=' * 80)

    lines.append(f'\n{" PARAMETROS DO TESTE ":=^80}')
    lines.append(f'  Simbolo:           {symbol}')
    lines.append(f'  Timeframe:         {timeframe}')
    lines.append(f'  Capital Inicial:   ${config.get("initial_capital", 10000):.2f}')
    lines.append(f'  Volume Fixo:       {config.get("fixed_volume", 0.1)} lots')
    lines.append(f'  Swing Period:      {config.get("swing_period", 10)}')
    lines.append(f'  Min R:R:           {config.get("min_rr", 2.5)}')
    lines.append(f'  BE Padding:        {config.get("breakeven_padding_pips", 20)} pips')
    lines.append(f'  Comissao:          ${config.get("commission_per_lot", 3.0)}/lot')
    lines.append(f'  Alavancagem:       1:{config.get("leverage", 100)}')

    lines.append(f'\n{" RESUMO DE PERFORMANCE ":=^80}')
    lines.append(f'  Total Trades:      {m["total_trades"]} (parciais: {len(partials)})')
    lines.append(f'  Trades Principais: {total_main}')
    lines.append(f'  Wins:              {wins_main}')
    lines.append(f'  Losses:            {losses_main}')
    wr = (wins_main / total_main * 100) if total_main > 0 else 0
    lines.append(f'  Win Rate:          {wr:.1f}%')
    lines.append(f'  Lucro Total:       ${m["total_pnl"]:.2f}')
    lines.append(f'  Retorno:           {m["total_return"]:.2f}%')
    lines.append(f'  Profit Factor:     {m["profit_factor"]:.2f}')
    lines.append(f'  Avg Win:           ${m["avg_win"]:.2f}')
    lines.append(f'  Avg Loss:          ${m["avg_loss"]:.2f}')
    lines.append(f'  Max Drawdown:      {m["max_drawdown"]:.2f}%')
    lines.append(f'  DD Value:          ${m["max_drawdown_value"]:.2f}')
    lines.append(f'  Sharpe Ratio:      {m["sharpe_ratio"]:.2f}')
    lines.append(f'  Saldo Final:       ${m["final_balance"]:.2f}')

    # Distribuicao de resultados
    if main_list:
        pnls = [t.get('pnl', 0) for t in main_list]
        lines.append(f'\n{" DISTRIBUICAO DE RESULTADOS ":=^80}')
        lines.append(f'  Maior Win:         ${max(pnls):.2f}')
        lines.append(f'  Maior Loss:        ${min(pnls):.2f}')
        lines.append(f'  Media PnL:         ${np.mean(pnls):.2f}')
        lines.append(f'  Mediana PnL:       ${np.median(pnls):.2f}')
        lines.append(f'  Desvio Padrao:     ${np.std(pnls):.2f}')
        lines.append(f'  Trades Positivos:  {sum(1 for p in pnls if p > 0)}')
        lines.append(f'  Trades Negativos:  {sum(1 for p in pnls if p <= 0)}')

    # Analise de BE+Custos
    if be_trades:
        lines.append(f'\n{" ANALISE BE+CUSTOS ":=^80}')
        lines.append(f'  Total BE+Custos:   {len(be_trades)} acionamentos')
        be_pnl = sum(t.get('pnl', 0) for t in be_trades)
        lines.append(f'  PnL Apos BE:       ${be_pnl:.2f}')

    # Equity Curve stats
    if eq:
        eq_df = pd.DataFrame(eq)
        if 'equity' in eq_df.columns:
            eq_vals = eq_df['equity'].values
            final_eq = eq_vals[-1]
            peak = np.maximum.accumulate(eq_vals)
            dd_pct = ((peak - eq_vals) / peak) * 100
            lines.append(f'\n{" CURVA DE EQUITY ":=^80}')
            lines.append(f'  Equity Inicial:    ${eq_vals[0]:.2f}')
            lines.append(f'  Equity Final:      ${final_eq:.2f}')
            lines.append(f'  Pico Maximo:       ${max(eq_vals):.2f}')
            lines.append(f'  Vale Minimo:       ${min(eq_vals):.2f}')
            lines.append(f'  Drawdown Medio:    {np.mean(dd_pct):.2f}%')

    # Tabela de trades
    if main_list:
        lines.append(f'\n{" TABELA DE TRADES ":=^80}')
        lines.append(f'  {"#":>3} {"Acao":>4} {"Entrada":>10} {"Saida":>10} {"Volume":>7} {"PnL":>10} {"Result":>6} {"Parcial":>7} {"Conf":>5}')
        lines.append(f'  {"-"*72}')
        for i, t in enumerate(main_list):
            acao = t.get('action', '')[:4]
            ent = t.get('entry_price', 0)
            sai = t.get('exit_price', 0)
            vol = t.get('volume', 0)
            pnl = t.get('pnl', 0)
            res = 'WIN' if pnl > 0 else 'LOSS'
            par = 'SIM' if 'PARTIAL' in t.get('comment', '') else ''
            # Extrair confianca do comment (S1_A, S2_B etc)
            conf = ''
            cmt = t.get('comment', '')
            if 'S1_' in cmt:
                conf = cmt.split('S1_')[1][:1]
            elif 'S2_' in cmt:
                conf = cmt.split('S2_')[1][:1]
            lines.append(f'  {i+1:>3} {acao:>4} {ent:>10.2f} {sai:>10.2f} {vol:>7.2f} {pnl:>10.2f} {res:>6} {par:>7} {conf:>5}')
        lines.append(f'  {"-"*72}')
        total_pnl = sum(t.get('pnl', 0) for t in main_list)
        lines.append(f'  {"":>3} {"":>4} {"":>10} {"TOTAL":>10} {"":>7} {total_pnl:>10.2f}')

    # Trades com BE+Custos
    if be_trades:
        lines.append(f'\n{" TRADES COM BE+CUSTOS ":=^80}')
        for t in be_trades:
            lines.append(f'  Ticket {t.get("ticket","?")}: {t.get("action","")} PnL=${t.get("pnl",0):.2f} {t.get("comment","")}')

    lines.append('\n' + '=' * 80)
    lines.append('  FIM DO RELATORIO')
    lines.append('=' * 80)

    return '\n'.join(lines)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Wolf Bot Backtest')
    parser.add_argument('--symbol', default='XAUUSD', help='Simbolo (ex: XAUUSD, EURUSD, BTCUSD)')
    parser.add_argument('--timeframe', default='1h', help='Timeframe (1h, 4h, 1d)')
    parser.add_argument('--bars', type=int, default=3000, help='Numero de barras historicas')
    parser.add_argument('--capital', type=float, default=10000, help='Capital inicial')
    parser.add_argument('--volume', type=float, default=0.1, help='Volume fixo (lots)')
    parser.add_argument('--swing', type=int, default=10, help='Swing period')
    parser.add_argument('--min-rr', type=float, default=2.5, help='Minimo R:R')
    parser.add_argument('--padding', type=int, default=20, help='BE padding em pips')
    parser.add_argument('--source', default='auto', help='Fonte: auto, mt5, polygon, litefinance')
    parser.add_argument('--save', action='store_true', help='Salva relatorio em arquivo')
    args = parser.parse_args()

    print(f'[WOLF BT] Baixando {args.bars} barras {args.timeframe} de {args.symbol}...')
    try:
        data = fetch_historical_data(
            symbol=args.symbol,
            timeframe=args.timeframe,
            bars=args.bars,
            source=args.source,
            allow_synthetic=True,
        )
    except Exception as e:
        print(f'[ERRO] Falha ao obter dados: {e}')
        sys.exit(1)

    df = data['dataframe']
    source_actual = data.get('source_actual', 'unknown')
    print(f'[WOLF BT] Fonte: {source_actual} | Barras obtidas: {len(df)}')

    if len(df) < 100:
        print(f'[ERRO] Apenas {len(df)} barras. Backtest cancelado.')
        sys.exit(1)

    config = {
        'strategy': 'wolf_bot',
        'symbol': args.symbol,
        'initial_capital': args.capital,
        'fixed_volume': args.volume,
        'commission_per_lot': 3.0,
        'leverage': 100,
        'swing_period': args.swing,
        'min_rr': args.min_rr,
        'breakeven_padding_pips': args.padding,
        'aggressive_mode': True,
        'conf_c_scale': 0.33,
        'session_filter': False,
    }

    print(f'[WOLF BT] Executando backtest...')
    result = run_backtest(df, config)

    if 'error' in result:
        print(f'[ERRO] {result["error"]}')
        sys.exit(1)

    report = generate_report(result, args.symbol, args.timeframe, config)
    print(report)

    # Salva JSON detalhado
    out_dir = os.path.join(os.path.dirname(__file__), '..', 'data', 'backtests')
    os.makedirs(out_dir, exist_ok=True)
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    report_path = os.path.join(out_dir, f'wolf_bot_{args.symbol}_{args.timeframe}_{ts}.txt')
    json_path = os.path.join(out_dir, f'wolf_bot_{args.symbol}_{args.timeframe}_{ts}.json')

    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(report)
    print(f'\n[WOLF BT] Relatorio salvo: {report_path}')

    # Salva resultado JSON
    result['config'] = config
    result['data_source'] = source_actual
    result['timestamp'] = datetime.now().isoformat()
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, default=str)
    print(f'[WOLF BT] JSON salvo: {json_path}')

    # Exibe estatisticas finais
    m = result['metrics']
    print(f'\n>>> RESUMO: {m["total_trades"]} trades | WR: {m["win_rate"]:.1f}% | Lucro: ${m["total_pnl"]:.2f} | PF: {m["profit_factor"]:.2f} | Sharpe: {m["sharpe_ratio"]:.2f} | DD: {m["max_drawdown"]:.2f}%')
