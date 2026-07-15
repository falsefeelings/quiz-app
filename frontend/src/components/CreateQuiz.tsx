import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Trash2, Image, Type, Check, Clock, Star } from 'lucide-react';

const API_URL = 'http://localhost:5000';

interface Question {
  type: 'TEXT' | 'IMAGE';
  selectionType: 'SINGLE' | 'MULTIPLE';
  text: string;
  imageUrl: string;
  options: string[];
  correctAnswer: string[];
  timeLimit: number;
  points: number;
}

export function CreateQuiz() {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([
    {
      type: 'TEXT',
      selectionType: 'SINGLE',
      text: '',
      imageUrl: '',
      options: ['', ''],
      correctAnswer: [],
      timeLimit: 30,
      points: 10,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        type: 'TEXT',
        selectionType: 'SINGLE',
        text: '',
        imageUrl: '',
        options: ['', ''],
        correctAnswer: [],
        timeLimit: 30,
        points: 10,
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index));
    }
  };

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], [field]: value };
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const addOption = (index: number) => {
    const updated = [...questions];
    updated[index].options.push('');
    setQuestions(updated);
  };

  const removeOption = (qIndex: number, oIndex: number) => {
    const updated = [...questions];
    updated[qIndex].options = updated[qIndex].options.filter((_, i) => i !== oIndex);
    setQuestions(updated);
  };

  const toggleCorrectAnswer = (qIndex: number, optionIndex: number) => {
    const updated = [...questions];
    const q = updated[qIndex];
    const value = String(optionIndex);
    
    if (q.selectionType === 'SINGLE') {
      q.correctAnswer = [value];
    } else {
      const index = q.correctAnswer.indexOf(value);
      if (index > -1) q.correctAnswer.splice(index, 1);
      else q.correctAnswer.push(value);
    }
    setQuestions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!title.trim()) {
      setError('Please enter a quiz title');
      setLoading(false);
      return;
    }

    for (const q of questions) {
      if (!q.text.trim()) {
        setError('Please enter text for all questions');
        setLoading(false);
        return;
      }
      if (q.options.some(o => !o.trim())) {
        setError('Please fill in all options');
        setLoading(false);
        return;
      }
      if (q.correctAnswer.length === 0) {
        setError('Please select correct answer(s) for all questions');
        setLoading(false);
        return;
      }
    }

    try {
      const response = await fetch(`${API_URL}/api/quizzes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title,
          description,
          questions: questions.map(q => ({
            ...q,
            options: q.options,
            correctAnswer: q.correctAnswer.map(Number),
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create quiz');
      }

      setSuccess('🎉 Quiz created successfully!');
      setTitle('');
      setDescription('');
      setQuestions([
        {
          type: 'TEXT',
          selectionType: 'SINGLE',
          text: '',
          imageUrl: '',
          options: ['', ''],
          correctAnswer: [],
          timeLimit: 30,
          points: 10,
        },
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to create quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 pt-24">
      <div className="glass-glow rounded-2xl p-8 animate-slide-up">
        <h1 className="text-3xl font-extrabold shimmer-text mb-2">📝 Create Quiz</h1>
        <p className="text-gray-400 text-sm mb-6">Build your own quiz with multiple questions and options</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Quiz Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-neon"
              placeholder="e.g. Trivia Night"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-neon"
              rows={2}
              placeholder="What is this quiz about?"
            />
          </div>

          {questions.map((q, qIndex) => (
            <div key={qIndex} className="glass rounded-2xl p-6 border border-white/5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white text-lg">Question {qIndex + 1}</h3>
                <button
                  type="button"
                  onClick={() => removeQuestion(qIndex)}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">Question Text</label>
                  <input
                    type="text"
                    value={q.text}
                    onChange={(e) => updateQuestion(qIndex, 'text', e.target.value)}
                    className="input-neon"
                    placeholder="Enter your question"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Type</label>
                    <select
                      value={q.type}
                      onChange={(e) => updateQuestion(qIndex, 'type', e.target.value)}
                      className="input-neon"
                    >
                      <option value="TEXT">📝 Text</option>
                      <option value="IMAGE">🖼️ Image</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Selection</label>
                    <select
                      value={q.selectionType}
                      onChange={(e) => {
                        updateQuestion(qIndex, 'selectionType', e.target.value);
                        updateQuestion(qIndex, 'correctAnswer', []);
                      }}
                      className="input-neon"
                    >
                      <option value="SINGLE">🔘 Single Choice</option>
                      <option value="MULTIPLE">☑️ Multiple Choice</option>
                    </select>
                  </div>
                </div>

                {q.type === 'IMAGE' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Image URL</label>
                    <input
                      type="url"
                      value={q.imageUrl}
                      onChange={(e) => updateQuestion(qIndex, 'imageUrl', e.target.value)}
                      className="input-neon"
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">⏱ Time Limit (s)</label>
                    <input
                      type="number"
                      value={q.timeLimit}
                      onChange={(e) => updateQuestion(qIndex, 'timeLimit', Number(e.target.value))}
                      className="input-neon"
                      min="5"
                      max="300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">⭐ Points</label>
                    <input
                      type="number"
                      value={q.points}
                      onChange={(e) => updateQuestion(qIndex, 'points', Number(e.target.value))}
                      className="input-neon"
                      min="1"
                      max="100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Options</label>
                  {q.options.map((opt, oIndex) => (
                    <div key={oIndex} className="flex items-center gap-2 mb-2">
                      <input
                        type={q.selectionType === 'SINGLE' ? 'radio' : 'checkbox'}
                        name={`correct-${qIndex}`}
                        checked={q.correctAnswer.includes(String(oIndex))}
                        onChange={() => toggleCorrectAnswer(qIndex, oIndex)}
                        className="w-5 h-5 text-indigo-500 focus:ring-indigo-500/20"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                        className="input-neon flex-1"
                        placeholder={`Option ${oIndex + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => removeOption(qIndex, oIndex)}
                        className="text-red-400 hover:text-red-300"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addOption(qIndex)}
                    className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Add Option
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addQuestion}
            className="btn-secondary-neon w-full flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> Add Question
          </button>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm">
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl text-sm">
              ✅ {success}
            </div>
          )}

          <button type="submit" className="btn-neon w-full" disabled={loading}>
            {loading ? 'Creating...' : '✨ Create Quiz'}
          </button>
        </form>
      </div>
    </div>
  );
}