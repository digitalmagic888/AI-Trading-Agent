import fs from "node:fs";
import path from "node:path";
import type { InterfaceAbi } from "ethers";
import solc from "solc";
import { repoRoot } from "../paths";

export interface CompiledContract {
  abi: InterfaceAbi;
  bytecode: string;
}

interface SolcOutputContract {
  abi: InterfaceAbi;
  evm: { bytecode: { object: string } };
}

interface SolcOutput {
  contracts?: Record<string, Record<string, SolcOutputContract>>;
  errors?: Array<{ severity: "error" | "warning"; formattedMessage: string }>;
}

export function compileContract(fileName: string, contractName: string): CompiledContract {
  const contractPath = path.join(repoRoot, "contracts", "contracts", fileName);
  const source = fs.readFileSync(contractPath, "utf8");
  const input = {
    language: "Solidity",
    sources: { [fileName]: { content: source } },
    settings: {
      optimizer: { enabled: true, runs: 500 },
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } }
    }
  };
  const output = JSON.parse(solc.compile(JSON.stringify(input))) as SolcOutput;
  const errors = output.errors ?? [];
  const fatal = errors.filter((error) => error.severity === "error");
  if (fatal.length > 0) throw new Error(fatal.map((error) => error.formattedMessage).join("\n"));
  const contract = output.contracts?.[fileName]?.[contractName];
  if (!contract) throw new Error(`Contract ${contractName} not found in ${fileName}`);
  const object = contract.evm.bytecode.object;
  if (!object) throw new Error(`Contract ${contractName} compiled without bytecode`);
  return { abi: contract.abi, bytecode: `0x${object}` };
}
