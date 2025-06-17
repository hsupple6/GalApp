import { NoteEntity, NoteError, UINote } from '../types/notes';
import fetchService from './fetchService';
import { API_BASE_URL } from '../api/config';
import { logger } from '../utils/logger';

export class NotesService {
  private baseUrl = `${API_BASE_URL}/notes`;

  private getAuthHeaders() {
    const authToken = localStorage.getItem('authToken');
    return {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    };
  }

  async fetchNote(id: string): Promise<UINote> {
    try {
      const note: NoteEntity = await fetchService(`${this.baseUrl}/${id}`, {
        credentials: 'include',
      });
      logger.log('[notesService] Fetched note from API:', note);

      return this.toUINote(note);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async fetchRecentNotes(): Promise<UINote[]> {
    try {
      const notes: NoteEntity[] = await fetchService(`${this.baseUrl}/recent`, {
        credentials: 'include',
      });
      return notes.map(this.toUINote);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createNote(): Promise<UINote> {
    try {
      const note: NoteEntity = await fetchService(this.baseUrl, {
        method: 'POST',
        credentials: 'include',
      });
      return this.toUINote(note);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateNoteContent(noteId: string, content: string) {
    // Don't save empty content
    if (!content.trim()) {
      return;
    }

    try {
      const response = await fetch(`${this.baseUrl}/${noteId}/content`, {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        logger.error('[notesService] Error response:', errorData);
        throw new NoteError('Failed to update note content', 'NETWORK_ERROR');
      }
    } catch (error) {
      logger.error('[notesService] Error updating note:', error);
      // Cast error to Error if it's an Error instance, otherwise pass undefined
      throw new NoteError('Failed to update note content', 'NETWORK_ERROR', error instanceof Error ? error : undefined);
    }
  }

    async streamContent(noteId: string, content: string): Promise<void> {
        logger.log('[notesService] Streaming content to note:', { 
            noteId, 
            contentLength: content.length,
            preview: content.substring(0, 100) 
        });

        if (!noteId) {
            throw new NoteError('Note ID is required', 'INVALID_INPUT');
        }

        // Don't stream empty content
        if (!content.trim()) {
            logger.log('[notesService] Skipping empty content stream');
            return;
        }

        try {
            const response = await fetch(`${this.baseUrl}/${noteId}/stream`, {
                method: 'POST',
                headers: this.getAuthHeaders(),
                credentials: 'include',
                body: JSON.stringify({ content })
            });

            if (!response.ok) {
                throw new NoteError('Failed to stream content to note', 'NETWORK_ERROR');
            }
        } catch (error) {
            logger.error('[notesService] Error streaming to note:', error);
            throw new NoteError(
                'Failed to stream content to note', 
                'NETWORK_ERROR', 
                error instanceof Error ? error : undefined
            );
        }
    }

  private toUINote(note: NoteEntity): UINote {
    return {
      id: note._id,
      title: note.skeleton.content?.slice?.(0, 50) || 'Untitled',
      content: note.skeleton.content || '',
      created: new Date(note.created_at),
      updated: new Date(note.updated_at),
      ydoc: note.skeleton.ydoc,
    };
  }

  private handleError(error: any): NoteError {
    if (error instanceof Response) {
      switch (error.status) {
        case 404:
          return new NoteError('Note not found', 'NOT_FOUND');
        case 403:
          return new NoteError('Permission denied', 'PERMISSION_DENIED');
        default:
          return new NoteError('Network error', 'NETWORK_ERROR');
      }
    }
    return new NoteError('Unknown error', 'NETWORK_ERROR', error);
  }
}

export const notesService = new NotesService();
