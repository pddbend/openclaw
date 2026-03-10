import type { GPPrediction } from "../types.js";

type Kernel = (x1: number, x2: number) => number;

type GPConfig = {
	lengthScale?: number;
	noiseVariance?: number;
	meanFunction?: (x: number) => number;
};

/**
 * Gaussian Process regressor based on Rasmussen & Williams 2006.
 * Provides uncertainty estimates for threshold prediction.
 */
export class GaussianProcessRegressor {
	private readonly kernel: Kernel;
	private readonly noiseVariance: number;
	private readonly meanFunction: (x: number) => number;
	private xTrain: number[] = [];
	private yTrain: number[] = [];
	private kInv: number[][] | null = null;

	constructor(config: GPConfig = {}) {
		const lengthScale = config.lengthScale ?? 0.3;
		this.noiseVariance = config.noiseVariance ?? 0.01;
		this.meanFunction = config.meanFunction ?? ((x: number) => 1 - x * 0.5);
		this.kernel = this.rbfKernel(lengthScale);
	}

	/**
	 * Add a new observation (x, y) where x = effectiveLoad, y = health.
	 */
	addObservation(x: number, y: number): void {
		this.xTrain.push(x);
		this.yTrain.push(y - this.meanFunction(x)); // Store residual from mean
		this.kInv = null; // Invalidate cache
	}

	/**
	 * Predict mean and variance at input x.
	 */
	predict(x: number): GPPrediction {
		if (this.xTrain.length === 0) {
			// No data: return prior
			return {
				mean: this.meanFunction(x),
				variance: 1.0, // High uncertainty
				effectiveLoad: x,
			};
		}

		// Compute K^-1 if needed
		if (!this.kInv) {
			this.kInv = this.computeKInverse();
		}

		// Compute k* (kernel between x and training points)
		const kStar = this.xTrain.map((xi) => this.kernel(x, xi));

		// Compute k** (kernel at x)
		const kStarStar = this.kernel(x, x) + this.noiseVariance;

		// Predict mean: μ* = m(x) + k*T * K^-1 * y
		const yCentered = this.yTrain;
		const kInvY = this.matrixVectorMultiply(this.kInv, yCentered);
		const mean = this.meanFunction(x) + this.dot(kStar, kInvY);

		// Predict variance: σ*² = k** - k*T * K^-1 * k*
		const kInvKStar = this.matrixVectorMultiply(this.kInv, kStar);
		const variance = Math.max(0.001, kStarStar - this.dot(kStar, kInvKStar));

		return {
			mean,
			variance,
			effectiveLoad: x,
		};
	}

	/**
	 * Get all stored observations.
	 */
	getObservations(): { x: number; y: number }[] {
		return this.xTrain.map((x, i) => ({
			x,
			y: this.yTrain[i] + this.meanFunction(x),
		}));
	}

	/**
	 * Compute K^-1 where K is the kernel matrix with noise.
	 */
	private computeKInverse(): number[][] {
		const n = this.xTrain.length;
		const k = this.identity(n, this.noiseVariance);

		// Add kernel values
		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				k[i][j] += this.kernel(this.xTrain[i], this.xTrain[j]);
			}
		}

		return this.matrixInverse(k);
	}

	/**
	 * RBF (Radial Basis Function) kernel.
	 */
	private rbfKernel(lengthScale: number): Kernel {
		return (x1, x2) => {
			const diff = x1 - x2;
			return Math.exp(-0.5 * (diff * diff) / (lengthScale * lengthScale));
		};
	}

	// Matrix operations

	private identity(n: number, diag: number): number[][] {
		const m: number[][] = [];
		for (let i = 0; i < n; i++) {
			m[i] = [];
			for (let j = 0; j < n; j++) {
				m[i][j] = i === j ? diag : 0;
			}
		}
		return m;
	}

	private matrixInverse(m: number[][]): number[][] {
		// Use Gauss-Jordan elimination for small matrices
		const n = m.length;
		const aug: number[][] = m.map((row, i) => [...row, ...this.identity(n, 1)[i]]);

		for (let col = 0; col < n; col++) {
			// Pivot
			let maxRow = col;
			for (let row = col + 1; row < n; row++) {
				if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
					maxRow = row;
				}
			}
			[aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

			// Scale pivot row
			const pivot = aug[col][col];
			for (let j = 0; j < 2 * n; j++) {
				aug[col][j] /= pivot;
			}

			// Eliminate
			for (let row = 0; row < n; row++) {
				if (row !== col) {
					const factor = aug[row][col];
					for (let j = 0; j < 2 * n; j++) {
						aug[row][j] -= factor * aug[col][j];
					}
				}
			}
		}

		// Extract inverse
		return aug.map((row) => row.slice(n));
	}

	private matrixVectorMultiply(m: number[][], v: number[]): number[] {
		return m.map((row) => this.dot(row, v));
	}

	private dot(a: number[], b: number[]): number {
		let sum = 0;
		for (let i = 0; i < a.length; i++) {
			sum += a[i] * b[i];
		}
		return sum;
	}
}