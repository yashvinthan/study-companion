"use client"

import { useState, useEffect, useCallback, useRef } from "react"

// Tetris pieces - pure black and white
const TETRIS_PIECES = [
  // I-piece
  { shape: [[1, 1, 1, 1]], color: 'bg-black dark:bg-white' },
  // O-piece
  { shape: [[1, 1], [1, 1]], color: 'bg-black dark:bg-white' },
  // T-piece
  { shape: [[0, 1, 0], [1, 1, 1]], color: 'bg-black dark:bg-white' },
  // L-piece
  { shape: [[1, 0], [1, 0], [1, 1]], color: 'bg-black dark:bg-white' },
  // S-piece
  { shape: [[0, 1, 1], [1, 1, 0]], color: 'bg-black dark:bg-white' },
  // Z-piece
  { shape: [[1, 1, 0], [0, 1, 1]], color: 'bg-black dark:bg-white' },
  // J-piece
  { shape: [[0, 1], [0, 1], [1, 1]], color: 'bg-black dark:bg-white' },
]

interface Cell {
  filled: boolean
  color: string
}

interface FallingPiece {
  shape: number[][]
  color: string
  x: number
  y: number
  id: string
}

export interface TetrisLoadingProps {
  size?: 'sm' | 'md' | 'lg'
  speed?: 'slow' | 'normal' | 'fast'
  showLoadingText?: boolean
  loadingText?: string
}

export default function TetrisLoading({ 
  size = 'md', 
  speed = 'normal',
  showLoadingText = true,
  loadingText = 'Loading...'
}: TetrisLoadingProps) {
  const sizeConfig = {
    sm: { cellSize: 'w-2 h-2', gridWidth: 8, gridHeight: 16, padding: 'p-0.5' },
    md: { cellSize: 'w-3 h-3', gridWidth: 10, gridHeight: 20, padding: 'p-1' },
    lg: { cellSize: 'w-4 h-4', gridWidth: 10, gridHeight: 20, padding: 'p-1.5' }
  }

  const speedConfig = {
    slow: 150,
    normal: 80,
    fast: 40
  }

  const config = sizeConfig[size]
  const fallSpeed = speedConfig[speed]

  const [grid, setGrid] = useState<Cell[][]>(() =>
    Array(config.gridHeight).fill(null).map(() => 
      Array(config.gridWidth).fill(null).map(() => ({ filled: false, color: '' }))
    )
  )
  const [fallingPiece, setFallingPiece] = useState<FallingPiece | null>(null)
  const [isClearing, setIsClearing] = useState(false)

  const [tick, setTick] = useState(0)

  // Rotate a shape 90 degrees clockwise
  const rotateShape = useCallback((shape: number[][]): number[][] => {
    const rows = shape.length
    const cols = shape[0].length
    const rotated: number[][] = Array(cols).fill(null).map(() => Array(rows).fill(0))

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        rotated[j][rows - 1 - i] = shape[i][j]
      }
    }

    return rotated
  }, [])

  // Create a new random piece
  const createNewPiece = useCallback((): FallingPiece => {
    const pieceData = TETRIS_PIECES[Math.floor(Math.random() * TETRIS_PIECES.length)]
    let shape = pieceData.shape
    
    // Random rotations
    const rotations = Math.floor(Math.random() * 4)
    for (let i = 0; i < rotations; i++) {
        shape = rotateShape(shape)
    }

    const maxX = config.gridWidth - shape[0].length
    const x = Math.floor(Math.random() * (maxX + 1))

    return {
      shape,
      color: pieceData.color,
      x,
      y: -shape.length,
      id: Math.random().toString(36).substr(2, 9),
    }
  }, [rotateShape, config.gridWidth])

  // Check if a piece can be placed at a position
  const canPlacePiece = useCallback((piece: FallingPiece, newX: number, newY: number): boolean => {
    for (let row = 0; row < piece.shape.length; row++) {
      for (let col = 0; col < piece.shape[row].length; col++) {
        if (piece.shape[row][col]) {
          const gridX = newX + col
          const gridY = newY + row

          if (gridX < 0 || gridX >= config.gridWidth || gridY >= config.gridHeight) {
            return false
          }

          if (gridY >= 0 && grid[gridY][gridX].filled) {
            return false
          }
        }
      }
    }
    return true
  }, [config.gridWidth, config.gridHeight, grid])

  // Place a piece on the grid
  const placePiece = useCallback((piece: FallingPiece) => {
    setGrid(prevGrid => {
      const newGrid = prevGrid.map(row => row.map(cell => ({ ...cell })))

      for (let row = 0; row < piece.shape.length; row++) {
        for (let col = 0; col < piece.shape[row].length; col++) {
          if (piece.shape[row][col]) {
            const gridX = piece.x + col
            const gridY = piece.y + row

            if (gridY >= 0 && gridY < config.gridHeight && gridX >= 0 && gridX < config.gridWidth) {
              newGrid[gridY][gridX] = { filled: true, color: piece.color }
            }
          }
        }
      }

      return newGrid
    })
  }, [config.gridHeight, config.gridWidth])

  // Clear completed lines with animation
  const clearFullLines = useCallback(() => {
    setGrid(prevGrid => {
      const linesToClear: number[] = []
      
      prevGrid.forEach((row, index) => {
        if (row.every(cell => cell.filled)) {
          linesToClear.push(index)
        }
      })

      if (linesToClear.length > 0) {
        setIsClearing(true)
        
        const newGrid = prevGrid.map((row, rowIndex) => {
          if (linesToClear.includes(rowIndex)) {
            return row.map(cell => ({ ...cell, color: 'bg-black dark:bg-white animate-pulse opacity-50' }))
          }
          return row
        })

        setTimeout(() => {
          setGrid(currentGrid => {
            const filteredGrid = currentGrid.filter((_, index) => !linesToClear.includes(index))
            const emptyRows = Array(linesToClear.length).fill(null).map(() => 
              Array(config.gridWidth).fill(null).map(() => ({ filled: false, color: '' }))
            )
            setIsClearing(false)
            return [...emptyRows, ...filteredGrid]
          })
        }, 200)

        return newGrid
      }

      return prevGrid
    })
  }, [config.gridWidth])

  // Check if we need to reset
  const checkAndReset = useCallback(() => {
    const topRows = grid.slice(0, 4)
    const needsReset = topRows.some(row => row.filter(cell => cell.filled).length > config.gridWidth * 0.7)

    if (needsReset) {
      setTimeout(() => setIsClearing(true), 0)
      setTimeout(() => {
        setGrid(Array(config.gridHeight).fill(null).map(() => 
          Array(config.gridWidth).fill(null).map(() => ({ filled: false, color: '' }))
        ))
        setFallingPiece(null)
        setIsClearing(false)
      }, 500)
      return true
    }
    return false
  }, [config.gridWidth, config.gridHeight, grid])

  // Clock driver
  useEffect(() => {
    if (isClearing) return;
    const timer = setTimeout(() => {
      setTick(t => t + 1)
    }, fallSpeed)
    return () => clearTimeout(timer)
  }, [tick, fallSpeed, isClearing])

  // Game loop driven by tick triggers
  useEffect(() => {
    if (isClearing) return;
    if (checkAndReset()) return;

    if (!fallingPiece) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFallingPiece(createNewPiece());
      return;
    }

    const newY = fallingPiece.y + 1;

    if (canPlacePiece(fallingPiece, fallingPiece.x, newY)) {
      setFallingPiece({ ...fallingPiece, y: newY });
    } else {
      placePiece(fallingPiece);
      setTimeout(clearFullLines, 50);
      setFallingPiece(createNewPiece());
    }
  }, [tick, fallingPiece, isClearing, checkAndReset, createNewPiece, canPlacePiece, placePiece, clearFullLines])

  // Render the grid
  const renderGrid = () => {
    const displayGrid = grid.map(row => row.map(cell => ({ ...cell })))

    if (fallingPiece && !isClearing) {
      for (let row = 0; row < fallingPiece.shape.length; row++) {
        for (let col = 0; col < fallingPiece.shape[row].length; col++) {
          if (fallingPiece.shape[row][col]) {
            const gridX = fallingPiece.x + col
            const gridY = fallingPiece.y + row

            if (gridY >= 0 && gridY < config.gridHeight && gridX >= 0 && gridX < config.gridWidth) {
              displayGrid[gridY][gridX] = { filled: true, color: fallingPiece.color }
            }
          }
        }
      }
    }

    return displayGrid.map((row, rowIndex) => (
      <div key={rowIndex} className="flex">
        {row.map((cell, colIndex) => (
          <div
            key={`${rowIndex}-${colIndex}`}
            className={`${config.cellSize} border border-gray-300 dark:border-gray-600 transition-all duration-100 ${
              cell.filled 
                ? `${cell.color} scale-100` 
                : 'bg-white dark:bg-black scale-95'
            } ${isClearing && rowIndex < 4 ? 'animate-pulse' : ''}`}
          />
        ))}
      </div>
    ))
  }

  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="mb-6">
        <div className={`border-2 border-gray-800 dark:border-gray-200 bg-white dark:bg-black ${config.padding} transition-colors rounded-sm shadow-xl`}>
          {renderGrid()}
        </div>
      </div>

      {showLoadingText && (
        <div className="text-center font-mono">
          <p className="text-black dark:text-white font-medium transition-colors animate-pulse">{loadingText}</p>
        </div>
      )}
    </div>
  )
}
