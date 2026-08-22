export const aaCharge = {
    "A": "H", "V": "H", "L": "H", "I": "H", "F": "H", "M": "H", "W": "H",
    "S": "0", "T": "0", "Y": "0", "N": "0", "Q": "0",
    "D": "-", "E": "-",
    "K": "+", "R": "+", "H": "+",
    "P": "null", "G": "null", "C": "null", "*": "null"
};

export function getChargeDesc(aa) {
    const charge = aaCharge[aa.toUpperCase()];
    const descriptions = {
        "+": "Положительный (+)",
        "-": "Отрицательный (-)",
        "0": "Полярный (0)",
        "H": "Гидрофобный (H)",
        "null": "Полярный"
    };
    return descriptions[charge] || "Неизвестный";
}

export function getAminoColor(aa) {
    const charge = aaCharge[aa.toUpperCase()];
    const colorMap = {
        "+": "#7ea7e5", "-": "#ab90e4", "0": "#98e4bc", "H": "#e4ca91", "null": "#ced6e8"
    };
    return colorMap[charge] || "#1f4e5e";
}

const nucleotideNames = { "A": "Аденин", "T": "Тимин", "U": "Урацил", "G": "Гуанин", "C": "Цитозин" };
const aminoAcidNames = {
    "A": "Аланин", "R": "Аргинин", "N": "Аспарагин", "D": "Аспарагиновая кислота", "C": "Цистеин",
    "E": "Глутаминовая кислота", "Q": "Глутамин", "G": "Глицин", "H": "Гистидин", "I": "Изолейцин",
    "L": "Лейцин", "K": "Лизин", "M": "Метионин", "F": "Фенилаланин", "P": "Пролин", "S": "Серин",
    "T": "Треонин", "W": "Триптофан", "Y": "Тирозин", "V": "Валин", "*": "Стоп-кодон"
};

export function getNucleotideName(letter) {
    return nucleotideNames[letter.toUpperCase()] || "Неизвестный нуклеотид";
}

export function getAminoAcidName(letter) {
    return aminoAcidNames[letter.toUpperCase()] || "Неизвестная аминокислота";
}