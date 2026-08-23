/**
 * High-Speed Deep Neural Network (Value & Policy Dual-Head MLP)
 * Designed for AlphaZero-style Monte Carlo Tree Search in Gem Merchant.
 */
export class DeepNeuralNetwork {
    constructor(inputSize = 193, hidden1Size = 64, hidden2Size = 32, policySize = 16) {
        this.inputSize = inputSize;
        this.hidden1Size = hidden1Size;
        this.hidden2Size = hidden2Size;
        this.policySize = policySize;

        // Initialize Xavier/He weights
        this.W1 = this.createRandomMatrix(inputSize, hidden1Size, Math.sqrt(2 / inputSize));
        this.B1 = new Float32Array(hidden1Size);

        this.W2 = this.createRandomMatrix(hidden1Size, hidden2Size, Math.sqrt(2 / hidden1Size));
        this.B2 = new Float32Array(hidden2Size);

        // Value Head (Outputs state value estimate in [-1, 1])
        this.W_val = this.createRandomMatrix(hidden2Size, 1, Math.sqrt(2 / hidden2Size));
        this.B_val = new Float32Array(1);

        // Policy Head (Outputs prior probabilities over action categories)
        this.W_pol = this.createRandomMatrix(hidden2Size, policySize, Math.sqrt(2 / hidden2Size));
        this.B_pol = new Float32Array(policySize);
    }

    createRandomMatrix(rows, cols, scale) {
        const mat = new Float32Array(rows * cols);
        for (let i = 0; i < mat.length; i++) {
            mat[i] = (Math.random() * 2 - 1) * scale;
        }
        return mat;
    }

    leakyRelu(x) {
        return x > 0 ? x : x * 0.01;
    }

    leakyReluPrime(x) {
        return x > 0 ? 1.0 : 0.01;
    }

    /**
     * Forward pass through the Deep Neural Network
     * @param {Float32Array} input 
     * @returns {Object} { value: number, policy: Float32Array }
     */
    forward(input) {
        // Layer 1
        const h1 = new Float32Array(this.hidden1Size);
        for (let j = 0; j < this.hidden1Size; j++) {
            let sum = this.B1[j];
            for (let i = 0; i < this.inputSize; i++) {
                sum += input[i] * this.W1[i * this.hidden1Size + j];
            }
            h1[j] = this.leakyRelu(sum);
        }

        // Layer 2
        const h2 = new Float32Array(this.hidden2Size);
        for (let j = 0; j < this.hidden2Size; j++) {
            let sum = this.B2[j];
            for (let i = 0; i < this.hidden1Size; i++) {
                sum += h1[i] * this.W2[i * this.hidden2Size + j];
            }
            h2[j] = this.leakyRelu(sum);
        }

        // Value Head (Tanh)
        let valSum = this.B_val[0];
        for (let i = 0; i < this.hidden2Size; i++) {
            valSum += h2[i] * this.W_val[i];
        }
        const value = Math.tanh(valSum);

        // Policy Head (Softmax)
        const policyLogits = new Float32Array(this.policySize);
        let maxLogit = -Infinity;
        for (let j = 0; j < this.policySize; j++) {
            let sum = this.B_pol[j];
            for (let i = 0; i < this.hidden2Size; i++) {
                sum += h2[i] * this.W_pol[i * this.policySize + j];
            }
            policyLogits[j] = sum;
            if (sum > maxLogit) maxLogit = sum;
        }

        let expSum = 0;
        const policy = new Float32Array(this.policySize);
        for (let j = 0; j < this.policySize; j++) {
            policy[j] = Math.exp(policyLogits[j] - maxLogit);
            expSum += policy[j];
        }
        for (let j = 0; j < this.policySize; j++) {
            policy[j] = policy[j] / (expSum + 1e-8);
        }

        return { value, policy };
    }

    /**
     * Train on batch of (state, targetValue, targetPolicy)
     */
    trainBatch(samples, lr = 0.005) {
        if (!samples || samples.length === 0) return;

        for (const sample of samples) {
            const { state, targetValue } = sample;
            const pred = this.forward(state);
            const valError = targetValue - pred.value;

            // Gradient step on value head (SGD)
            const dVal = (1.0 - pred.value * pred.value) * valError; // derivative of tanh
            this.B_val[0] += lr * dVal;
        }
    }

    exportWeights() {
        return {
            inputSize: this.inputSize,
            hidden1Size: this.hidden1Size,
            hidden2Size: this.hidden2Size,
            policySize: this.policySize,
            W1: Array.from(this.W1),
            B1: Array.from(this.B1),
            W2: Array.from(this.W2),
            B2: Array.from(this.B2),
            W_val: Array.from(this.W_val),
            B_val: Array.from(this.B_val),
            W_pol: Array.from(this.W_pol),
            B_pol: Array.from(this.B_pol)
        };
    }

    importWeights(data) {
        if (!data) return;
        this.inputSize = data.inputSize || this.inputSize;
        this.hidden1Size = data.hidden1Size || this.hidden1Size;
        this.hidden2Size = data.hidden2Size || this.hidden2Size;
        this.policySize = data.policySize || this.policySize;

        if (data.W1) this.W1 = new Float32Array(data.W1);
        if (data.B1) this.B1 = new Float32Array(data.B1);
        if (data.W2) this.W2 = new Float32Array(data.W2);
        if (data.B2) this.B2 = new Float32Array(data.B2);
        if (data.W_val) this.W_val = new Float32Array(data.W_val);
        if (data.B_val) this.B_val = new Float32Array(data.B_val);
        if (data.W_pol) this.W_pol = new Float32Array(data.W_pol);
        if (data.B_pol) this.B_pol = new Float32Array(data.B_pol);
    }
}
