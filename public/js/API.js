export class API {
    static async getRiddles() {
        const response = await fetch('/api/riddle/list');
        const data = await response.json();
        return data.data;
    }

    /**
     * Interact with the riddle
     * @param {Object} payload
     * @param {string} payload.playerInput
     * @param {number} payload.level
     * @param {number} payload.order
     * @param {boolean} payload.revealAnswer
     * @param {Array} payload.history
     * 
     * @returns {Promise<{isLose: boolean, message: string, ok: boolean, result: 'BENAR' | 'SALAH' | 'HAMPIR' | null, type: 'answer_check' | 'hint' | 'question' | 'other'>}>}
     */
    static async interact(payload) {
        const response = await fetch('/api/riddle/interact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        return await response.json();
    }
}
