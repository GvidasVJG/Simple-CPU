// Define registers and memory
let registers = {
    PC: 0x00,  // Program Counter
    IR: '',    // Instruction Register
    R0: 0x00,
    R1: 0x00,
    R2: 0x00
};

let flags = {
    ZF: 0, // Zero Flag
    SF: 0  // Sign Flag
};

let memory = new Array(256).fill(0x00); // 256 bytes of memory
let isRunning = false;
let output = '';
let highlightedElements = []; // Array to keep track of highlighted elements
let executionSpeed = 500; // Default execution speed in ms

window.onload = function() {
    renderMemoryTable();
    updateRegisterDisplay();
    updateLineNumbers();
};

// Render the memory table
function renderMemoryTable() {
    const container = document.getElementById("memoryContainer");
    container.innerHTML = ''; // Clear previous content

    const table = document.createElement("table");
    table.id = "memoryTable";

    // Create table header
    const headerRow = document.createElement("tr");
    const emptyHeader = document.createElement("th");
    headerRow.appendChild(emptyHeader);

    for (let col = 0; col < 16; col++) {
        const th = document.createElement("th");
        th.textContent = col.toString(16).toUpperCase().padStart(2, "0");
        headerRow.appendChild(th);
    }
    table.appendChild(headerRow);

    // Create table body
    for (let row = 0; row < 16; row++) {
        const tr = document.createElement("tr");
        const rowHeader = document.createElement("th");
        rowHeader.textContent = (row * 16).toString(16).toUpperCase().padStart(2, "0");
        tr.appendChild(rowHeader);

        for (let col = 0; col < 16; col++) {
            const td = document.createElement("td");
            const address = row * 16 + col;
            td.id = `mem-${address.toString(16).toUpperCase().padStart(2, "0")}`;
            td.textContent = memory[address].toString(16).toUpperCase().padStart(2, "0");
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    container.appendChild(table);
}

// Update the display of a single memory cell
function updateMemoryCell(address) {
    const cellId = `mem-${address.toString(16).toUpperCase().padStart(2, "0")}`;
    const cell = document.getElementById(cellId);
    if (cell) {
        cell.textContent = memory[address].toString(16).toUpperCase().padStart(2, "0");
    }
}

// Update register display
function updateRegisterDisplay() {
    for (let reg in registers) {
        const element = document.getElementById(reg);
        if (element) {
            if (reg === 'IR') {
                element.textContent = registers[reg];
            } else {
                element.textContent = registers[reg].toString(16).toUpperCase().padStart(2, "0");
            }
        }
    }
    // Update flags display
    document.getElementById("ZF").textContent = flags.ZF;
    document.getElementById("SF").textContent = flags.SF;
}

// Update line numbers (for code editor)
function updateLineNumbers() {
    const assemblyInput = document.getElementById("assemblyInput");
    const lineNumbers = document.getElementById("lineNumbers");
    if (assemblyInput && lineNumbers) {
        const lines = assemblyInput.value.split('\n').length;
        lineNumbers.innerHTML = '';
        for (let i = 1; i <= lines; i++) {
            lineNumbers.innerHTML += i + '<br>';
        }
    }
}

// Toggle code editor visibility
function toggleCodeEditor() {
    const codeEditor = document.getElementById("codeEditorContainer");
    if (codeEditor.style.display === "none") {
        codeEditor.style.display = "block";
    } else {
        codeEditor.style.display = "none";
    }
}

// Load memory from memory input area
function loadMemory() {
    const memoryInput = document.getElementById("memoryInput").value.split('\n');
    for (let line of memoryInput) {
        const cleanLine = line.trim();
        if (cleanLine.length === 0) continue;
        const match = cleanLine.match(/^\[([0-9A-F]{2})\]:\s*([0-9A-F]{2})$/i);
        if (match) {
            const address = parseInt(match[1], 16);
            const value = parseInt(match[2], 16);
            if (address >= 0 && address <= 255 && value >= 0 && value <= 255) {
                memory[address] = value;
                updateMemoryCell(address);
            } else {
                alert(`Invalid address or value: ${cleanLine}`);
                return;
            }
        } else {
            alert(`Invalid format: ${cleanLine}`);
            return;
        }
    }
}

// Assembler: Assemble code and load into memory
function assembleCode() {
    const assemblyInput = document.getElementById("assemblyInput").value.split('\n');
    let address = 0x00; // Start loading program at address 0x00
    let symbolTable = {};

    // First pass: Build symbol table
    for (let line of assemblyInput) {
        const cleanLine = line.split(';')[0].trim(); // Remove comments and trim
        if (cleanLine.length === 0) continue;

        if (/^[A-Z_][A-Z0-9_]*:$/i.test(cleanLine)) {
            // Label definition
            let label = cleanLine.slice(0, -1);
            if (symbolTable.hasOwnProperty(label)) {
                alert(`Duplicate label: ${label}`);
                return;
            }
            symbolTable[label] = address;
        } else {
            // Instruction - estimate its size to update address
            const instructionSize = estimateInstructionSize(cleanLine);
            if (instructionSize === null) {
                alert(`Error estimating size for line: ${cleanLine}`);
                return;
            }
            address = (address + instructionSize) & 0xFF;
        }
    }

    // Second pass: Assemble instructions
    address = 0x00;
    for (let lineNumber = 0; lineNumber < assemblyInput.length; lineNumber++) {
        let line = assemblyInput[lineNumber];
        const cleanLineWithComments = line.trim();
        const cleanLine = line.split(';')[0].trim(); // Remove comments and trim
        if (cleanLine.length === 0) continue;

        if (/^[A-Z_][A-Z0-9_]*:$/i.test(cleanLine)) {
            // Label definition - skip
            continue;
        } else {
            const machineCode = assembleInstruction(cleanLine, symbolTable);
            if (machineCode === null) {
                alert(`Error assembling line ${lineNumber + 1}: ${cleanLineWithComments}`);
                return;
            }
            for (let byte of machineCode) {
                memory[address] = byte;
                updateMemoryCell(address);
                address = (address + 1) & 0xFF; // Wrap around if address exceeds 255
            }
        }
    }
}

// Function to estimate instruction size
function estimateInstructionSize(instruction) {
    const tokens = instruction.replace(',', ' ').trim().split(/\s+/);
    if (tokens.length === 0) return 0;

    const cmd = tokens[0].toUpperCase();
    const args = tokens.slice(1);

    // Opcode size is 1 byte
    let size = 1;
    // Each operand is 1 byte
    size += args.length;
    return size;
}

// Assemble a single instruction
function assembleInstruction(instruction, symbolTable) {
    const tokens = instruction.replace(',', ' ').trim().split(/\s+/);

    // Skip empty lines
    if (tokens.length === 0 || tokens[0] === '') {
        return [];
    }

    const opcodeMap = {
        'MOV': {
            'REG IMM': 0x10,
            'REG REG': 0x11,
            'REG [ADDR]': 0x12,
            '[ADDR] REG': 0x13
        },
        'ADD': {
            'REG IMM': 0x20,
            'REG REG': 0x21,
            'REG [ADDR]': 0x22
        },
        'SUB': {
            'REG IMM': 0x30,
            'REG REG': 0x31,
            'REG [ADDR]': 0x32
        },
        'INC': {
            'REG': 0x40
        },
        'DEC': {
            'REG': 0x41
        },
        'OUT': {
            'REG': 0x50
        },
        'JMP': {
            'ADDR': 0x60,
            'LABEL': 0x60
        },
        'CMP': {
            'REG IMM': 0x70,
            'REG REG': 0x71,
            'REG [ADDR]': 0x72
        },
        'JE': {
            'ADDR': 0x80,
            'LABEL': 0x80
        },
        'JNE': {
            'ADDR': 0x81,
            'LABEL': 0x81
        },
        'JG': {
            'ADDR': 0x82,
            'LABEL': 0x82
        },
        'JL': {
            'ADDR': 0x83,
            'LABEL': 0x83
        },
        'HLT': {
            '': 0xFF
        }
    };

    const registerMap = {
        'R0': 0x00,
        'R1': 0x01,
        'R2': 0x02
    };

    const cmd = tokens[0].toUpperCase();
    const args = tokens.slice(1);

    if (!opcodeMap.hasOwnProperty(cmd)) {
        alert(`Unknown instruction: ${cmd}`);
        return null;
    }

    // Determine operand types
    let operandType = '';
    for (let i = 0; i < args.length; i++) {
        let arg = args[i];
        if (arg in registerMap) {
            operandType += 'REG';
        } else if (/^\[([0-9A-F]{2})\]$/i.test(arg)) {
            operandType += '[ADDR]';
        } else if (/^[0-9A-F]{1,2}$/i.test(arg)) {
            operandType += 'IMM';
        } else if (/^[A-Z_][A-Z0-9_]*$/i.test(arg)) {
            operandType += 'LABEL';
        } else {
            alert(`Invalid operand: ${arg}`);
            return null;
        }
        if (i < args.length - 1) operandType += ' ';
    }

    if (!opcodeMap[cmd].hasOwnProperty(operandType)) {
        alert(`Invalid operands for ${cmd}: ${operandType}`);
        return null;
    }

    const opcode = opcodeMap[cmd][operandType];
    const machineCode = [opcode];

    // Encode operands
    for (let arg of args) {
        if (arg in registerMap) {
            machineCode.push(registerMap[arg]);
        } else if (/^\[([0-9A-F]{2})\]$/i.test(arg)) {
            const address = parseInt(arg.slice(1, -1), 16);
            machineCode.push(address);
        } else if (/^[0-9A-F]{1,2}$/i.test(arg)) {
            const immediate = parseInt(arg, 16);
            machineCode.push(immediate);
        } else if (/^[A-Z_][A-Z0-9_]*$/i.test(arg)) {
            // Operand is a label
            if (symbolTable.hasOwnProperty(arg)) {
                const address = symbolTable[arg];
                machineCode.push(address);
            } else {
                alert(`Undefined label: ${arg}`);
                return null;
            }
        }
    }

    return machineCode;
}

// Fetch-decode-execute cycle
function fetchDecodeExecute() {
    // Fetch
    const pc = registers.PC;
    const opcode = memory[pc];
    if (opcode === undefined) {
        alert(`Program Counter out of bounds: ${pc}`);
        isRunning = false;
        return;
    }
    registers.IR = opcode.toString(16).toUpperCase().padStart(2, "0");
    highlightOpcode(`mem-${pc.toString(16).toUpperCase().padStart(2, "0")}`);
    updateRegisterDisplay();

    // Decode and Execute
    const increment = executeInstructionAtPC(opcode);

    // Update PC
    registers.PC = (registers.PC + increment) & 0xFF;
    updateRegisterDisplay();
}

// Execute instruction at PC
function executeInstructionAtPC(opcode) {
    const pc = registers.PC;
    let increment = 1; // By default, increment PC by 1

    switch (opcode) {
        // MOV Instructions
        case 0x10: // MOV REG, IMM
            {
                const regCode = memory[pc + 1];
                const immediate = memory[pc + 2];
                const regName = getRegisterName(regCode);
                if (!regName) {
                    alert(`Invalid register code at address ${pc + 1}: ${regCode}`);
                    isRunning = false;
                    return 0;
                }
                registers[regName] = immediate;
                highlightElement(regName);
                increment = 3;
            }
            break;
        case 0x11: // MOV REG, REG
            {
                const regCodeDest = memory[pc + 1];
                const regCodeSrc = memory[pc + 2];
                const regNameDest = getRegisterName(regCodeDest);
                const regNameSrc = getRegisterName(regCodeSrc);
                if (!regNameDest || !regNameSrc) {
                    alert(`Invalid register code at address ${pc + 1} or ${pc + 2}`);
                    isRunning = false;
                    return 0;
                }
                registers[regNameDest] = registers[regNameSrc];
                highlightElement(regNameDest);
                increment = 3;
            }
            break;
        case 0x12: // MOV REG, [ADDR]
            {
                const regCode = memory[pc + 1];
                const address = memory[pc + 2];
                const regName = getRegisterName(regCode);
                if (!regName || address > 0xFF) {
                    alert(`Invalid register code or address at ${pc + 1} or ${pc + 2}`);
                    isRunning = false;
                    return 0;
                }
                registers[regName] = memory[address];
                highlightElement(regName);
                increment = 3;
            }
            break;
        case 0x13: // MOV [ADDR], REG
            {
                const address = memory[pc + 1];
                const regCode = memory[pc + 2];
                const regName = getRegisterName(regCode);
                if (!regName || address > 0xFF) {
                    alert(`Invalid register code or address at ${pc + 1} or ${pc + 2}`);
                    isRunning = false;
                    return 0;
                }
                memory[address] = registers[regName];
                updateMemoryCell(address);
                highlightElement(`mem-${address.toString(16).toUpperCase().padStart(2, "0")}`);
                increment = 3;
            }
            break;
        // ADD Instructions
        case 0x20: // ADD REG, IMM
            {
                const regCode = memory[pc + 1];
                const immediate = memory[pc + 2];
                const regName = getRegisterName(regCode);
                if (!regName) {
                    alert(`Invalid register code at address ${pc + 1}: ${regCode}`);
                    isRunning = false;
                    return 0;
                }
                registers[regName] = (registers[regName] + immediate) & 0xFF;
                highlightElement(regName);
                increment = 3;
            }
            break;
        case 0x21: // ADD REG, REG
            {
                const regCodeDest = memory[pc + 1];
                const regCodeSrc = memory[pc + 2];
                const regNameDest = getRegisterName(regCodeDest);
                const regNameSrc = getRegisterName(regCodeSrc);
                if (!regNameDest || !regNameSrc) {
                    alert(`Invalid register code at address ${pc + 1} or ${pc + 2}`);
                    isRunning = false;
                    return 0;
                }
                registers[regNameDest] = (registers[regNameDest] + registers[regNameSrc]) & 0xFF;
                highlightElement(regNameDest);
                increment = 3;
            }
            break;
        case 0x22: // ADD REG, [ADDR]
            {
                const regCode = memory[pc + 1];
                const address = memory[pc + 2];
                const regName = getRegisterName(regCode);
                if (!regName || address > 0xFF) {
                    alert(`Invalid register code or address at ${pc + 1} or ${pc + 2}`);
                    isRunning = false;
                    return 0;
                }
                registers[regName] = (registers[regName] + memory[address]) & 0xFF;
                highlightElement(regName);
                increment = 3;
            }
            break;
        // SUB Instructions
        case 0x30: // SUB REG, IMM
            {
                const regCode = memory[pc + 1];
                const immediate = memory[pc + 2];
                const regName = getRegisterName(regCode);
                if (!regName) {
                    alert(`Invalid register code at address ${pc + 1}: ${regCode}`);
                    isRunning = false;
                    return 0;
                }
                registers[regName] = (registers[regName] - immediate) & 0xFF;
                highlightElement(regName);
                increment = 3;
            }
            break;
        case 0x31: // SUB REG, REG
            {
                const regCodeDest = memory[pc + 1];
                const regCodeSrc = memory[pc + 2];
                const regNameDest = getRegisterName(regCodeDest);
                const regNameSrc = getRegisterName(regCodeSrc);
                if (!regNameDest || !regNameSrc) {
                    alert(`Invalid register code at address ${pc + 1} or ${pc + 2}`);
                    isRunning = false;
                    return 0;
                }
                registers[regNameDest] = (registers[regNameDest] - registers[regNameSrc]) & 0xFF;
                highlightElement(regNameDest);
                increment = 3;
            }
            break;
        case 0x32: // SUB REG, [ADDR]
            {
                const regCode = memory[pc + 1];
                const address = memory[pc + 2];
                const regName = getRegisterName(regCode);
                if (!regName || address > 0xFF) {
                    alert(`Invalid register code or address at ${pc + 1} or ${pc + 2}`);
                    isRunning = false;
                    return 0;
                }
                registers[regName] = (registers[regName] - memory[address]) & 0xFF;
                highlightElement(regName);
                increment = 3;
            }
            break;
        // INC Instruction
        case 0x40: // INC REG
            {
                const regCode = memory[pc + 1];
                const regName = getRegisterName(regCode);
                if (!regName) {
                    alert(`Invalid register code at address ${pc + 1}: ${regCode}`);
                    isRunning = false;
                    return 0;
                }
                registers[regName] = (registers[regName] + 1) & 0xFF;
                highlightElement(regName);
                increment = 2;
            }
            break;
        // DEC Instruction
        case 0x41: // DEC REG
            {
                const regCode = memory[pc + 1];
                const regName = getRegisterName(regCode);
                if (!regName) {
                    alert(`Invalid register code at address ${pc + 1}: ${regCode}`);
                    isRunning = false;
                    return 0;
                }
                registers[regName] = (registers[regName] - 1) & 0xFF;
                highlightElement(regName);
                increment = 2;
            }
            break;
        // OUT Instruction
        case 0x50: // OUT REG
            {
                const regCode = memory[pc + 1];
                const regName = getRegisterName(regCode);
                if (!regName) {
                    alert(`Invalid register code at address ${pc + 1}: ${regCode}`);
                    isRunning = false;
                    return 0;
                }
                output += registers[regName].toString(16).toUpperCase().padStart(2, '0') + '\n';
                document.getElementById('outputField').innerText = output;
                increment = 2;
            }
            break;
        // JMP Instruction
        case 0x60: // JMP ADDR
            {
                const address = memory[pc + 1];
                if (address > 0xFF) {
                    alert(`Invalid jump address at ${pc + 1}: ${address}`);
                    isRunning = false;
                    return 0;
                }
                registers.PC = address;
                increment = 0; // PC is already set
            }
            break;
        // CMP Instructions
        case 0x70: // CMP REG, IMM
            {
                const regCode = memory[pc + 1];
                const immediate = memory[pc + 2];
                const regName = getRegisterName(regCode);
                if (!regName) {
                    alert(`Invalid register code at address ${pc + 1}: ${regCode}`);
                    isRunning = false;
                    return 0;
                }
                const result = registers[regName] - immediate;
                updateFlags(result);
                highlightFlags();
                increment = 3;
            }
            break;
        case 0x71: // CMP REG, REG
            {
                const regCode1 = memory[pc + 1];
                const regCode2 = memory[pc + 2];
                const regName1 = getRegisterName(regCode1);
                const regName2 = getRegisterName(regCode2);
                if (!regName1 || !regName2) {
                    alert(`Invalid register codes at addresses ${pc + 1} and ${pc + 2}`);
                    isRunning = false;
                    return 0;
                }
                const result = registers[regName1] - registers[regName2];
                updateFlags(result);
                highlightFlags();
                increment = 3;
            }
            break;
        case 0x72: // CMP REG, [ADDR]
            {
                const regCode = memory[pc + 1];
                const address = memory[pc + 2];
                const regName = getRegisterName(regCode);
                if (!regName || address > 0xFF) {
                    alert(`Invalid register code or address at addresses ${pc + 1} and ${pc + 2}`);
                    isRunning = false;
                    return 0;
                }
                const result = registers[regName] - memory[address];
                updateFlags(result);
                highlightFlags();
                increment = 3;
            }
            break;
        // Conditional Jump Instructions
        case 0x80: // JE ADDR
            {
                const address = memory[pc + 1];
                if (address > 0xFF) {
                    alert(`Invalid jump address at ${pc + 1}: ${address}`);
                    isRunning = false;
                    return 0;
                }
                if (flags.ZF === 1) {
                    registers.PC = address;
                    increment = 0;
                } else {
                    increment = 2;
                }
            }
            break;
        case 0x81: // JNE ADDR
            {
                const address = memory[pc + 1];
                if (address > 0xFF) {
                    alert(`Invalid jump address at ${pc + 1}: ${address}`);
                    isRunning = false;
                    return 0;
                }
                if (flags.ZF === 0) {
                    registers.PC = address;
                    increment = 0;
                } else {
                    increment = 2;
                }
            }
            break;
        case 0x82: // JG ADDR
            {
                const address = memory[pc + 1];
                if (address > 0xFF) {
                    alert(`Invalid jump address at ${pc + 1}: ${address}`);
                    isRunning = false;
                    return 0;
                }
                if (flags.ZF === 0 && flags.SF === 0) {
                    registers.PC = address;
                    increment = 0;
                } else {
                    increment = 2;
                }
            }
            break;
        case 0x83: // JL ADDR
            {
                const address = memory[pc + 1];
                if (address > 0xFF) {
                    alert(`Invalid jump address at ${pc + 1}: ${address}`);
                    isRunning = false;
                    return 0;
                }
                if (flags.SF === 1) {
                    registers.PC = address;
                    increment = 0;
                } else {
                    increment = 2;
                }
            }
            break;
        // HLT Instruction
        case 0xFF: // HLT
            {
                isRunning = false;
                alert('Program Halted');
                increment = 1;
            }
            break;
        default:
            alert(`Unknown opcode at address ${pc}: ${opcode.toString(16).toUpperCase()}`);
            isRunning = false;
            increment = 0;
            break;
    }

    return increment;
}

// Update flags based on result
function updateFlags(result) {
    flags.ZF = (result & 0xFF) === 0 ? 1 : 0;
    flags.SF = (result & 0x80) !== 0 ? 1 : 0; // Check if the sign bit is set
}

// Highlight flags
function highlightFlags() {
    highlightElement('ZF');
    highlightElement('SF');
}

// Get register name from code
function getRegisterName(code) {
    switch (code) {
        case 0x00: return 'R0';
        case 0x01: return 'R1';
        case 0x02: return 'R2';
        default: return null;
    }
}

// Highlight changes
function highlightElement(elementId) {
    const element = document.getElementById(elementId);
    if (element && !highlightedElements.includes(elementId)) {
        element.classList.add("highlight-change");
        highlightedElements.push(elementId);
    }
}

// Highlight opcode
function highlightOpcode(elementId) {
    const element = document.getElementById(elementId);
    if (element && !highlightedElements.includes(elementId)) {
        element.classList.add("highlight-opcode");
        highlightedElements.push(elementId);
    }
}

// Clear all highlights
function clearHighlights() {
    for (let elementId of highlightedElements) {
        const element = document.getElementById(elementId);
        if (element) {
            element.classList.remove("highlight-change");
            element.classList.remove("highlight-opcode");
        }
    }
    highlightedElements = [];
}

// Run program
function runProgram() {
    if (isRunning) return;
    reset(false); // Do not reset code editor
    isRunning = true;
    executeAllInstructions();
}

// Execute all instructions with delay
async function executeAllInstructions() {
    while (isRunning) {
        await executeNextInstruction();
        await delay(executionSpeed); // Adjust delay as per execution speed
    }
}

// Execute next instruction
async function executeNextInstruction() {
    if (!isRunning) return;

    // Clear previous highlights
    clearHighlights();

    fetchDecodeExecute();

    // Update displays
    updateRegisterDisplay();

    // Check if PC has exceeded memory bounds
    if (registers.PC > 0xFF) {
        alert("Program Counter exceeded memory bounds.");
        isRunning = false;
    }
}

// Step program
async function stepProgram() {
    if (!isRunning) {
        reset(false);
        isRunning = true;
    }
    if (isRunning) {
        await executeNextInstruction();
    }
}

// Reset function
function reset(resetCodeEditor = true) {
    registers.PC = 0x00;
    registers.IR = '';
    registers.R0 = 0x00;
    registers.R1 = 0x00;
    registers.R2 = 0x00;
    flags.ZF = 0;
    flags.SF = 0;
    isRunning = false;
    output = '';
    updateRegisterDisplay();
    // Update all memory cells without re-rendering the table
    for (let i = 0; i < memory.length; i++) {
        updateMemoryCell(i);
    }
    document.getElementById("outputField").innerText = '';
    if (resetCodeEditor && document.getElementById("assemblyInput")) {
        document.getElementById("assemblyInput").value = '';
    }
    if (document.getElementById("memoryInput")) {
        document.getElementById("memoryInput").value = '';
    }
    updateLineNumbers();
    clearHighlights(); // Clear highlights after resetting elements
    highlightedElements = []; // Reset highlighted elements array
}

// Delay function
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Event Listeners
document.getElementById("runButton").addEventListener("click", runProgram);
document.getElementById("stepButton").addEventListener("click", stepProgram);
document.getElementById("resetButton").addEventListener("click", () => reset(false));
document.getElementById("toggleEditorButton").addEventListener("click", toggleCodeEditor);
document.getElementById("loadMemoryButton").addEventListener("click", loadMemory);
if (document.getElementById("assembleButton")) {
    document.getElementById("assembleButton").addEventListener("click", assembleCode);
}
if (document.getElementById("assemblyInput")) {
    document.getElementById("assemblyInput").addEventListener("input", updateLineNumbers);
}

// Speed Slider
document.getElementById("speedSlider").addEventListener("input", function() {
    executionSpeed = parseInt(this.value);
});

// Help Modal Functionality
const helpModal = document.getElementById("helpModal");
const helpButton = document.getElementById("helpButton");
const closeHelp = document.getElementById("closeHelp");

helpButton.onclick = function() {
    helpModal.style.display = "block";
}

closeHelp.onclick = function() {
    helpModal.style.display = "none";
}

window.onclick = function(event) {
    if (event.target == helpModal) {
        helpModal.style.display = "none";
    }
}
